import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { claude, STRATEGIST_SYSTEM_PROMPT } from "@/lib/claude";
import { checkRateLimit } from "@/lib/rate-limiter";
import { compactMessages, type CompactableChatMessage } from "@/lib/chat-compaction";
import { buildUserContext } from "@/lib/social/indexer";
import { z } from "zod";

const requestSchema = z.object({
  sessionId: z.string(),
  message: z.string().min(1),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .optional(),
  existingNodes: z
    .array(
      z.object({
        id: z.string(),
        type: z.string(),
        title: z.string(),
      }),
    )
    .optional(),
});

// WHY: Agentic system prompt — tells Claude to return structured action blocks
// that the frontend will parse and execute against the platform's APIs.
const WORKSPACE_SYSTEM_PROMPT = `${STRATEGIST_SYSTEM_PROMPT}

You are now operating in the Creative Workspace mode. The user's canvas currently has {existingNodes} content nodes.

When you take actions, the frontend will automatically:
- CREATE_IMAGE: call the image generation API and add a node to the canvas
- CREATE_VIDEO: create VideoScene objects and add a video node to the canvas
- CREATE_COPY: call the copy generation API and add a node to the canvas
- SCHEDULE_POST: create a calendar entry
- PUBLISH_NOW: publish content to connected social platforms
- GET_ANALYTICS: fetch and display analytics inline

You can also return a legacy JSON block (wrapped in \`\`\`json ... \`\`\`) with a "nodes" array if you need to create canvas nodes directly:
\`\`\`json
{
  "nodes": [
    {"type": "image|video|copy|post", "title": "...", "prompt": "..."}
  ]
}
\`\`\`

For video requests, break the video into scenes:
\`\`\`json
{
  "nodes": [
    {"type": "video", "title": "...", "prompt": "...", "videoProjectId": "auto", "scenes": [{"prompt": "...", "duration": 5}]}
  ]
}
\`\`\`

For campaign requests, return multiple nodes of different types that form a connected pipeline.

If the user is just chatting or asking questions, respond normally WITHOUT any action or JSON blocks.`;

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email ?? session.user.id ?? "unknown";
    const { allowed, remaining } = checkRateLimit(`create:${email}`, 15);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again in a minute." },
        { status: 429, headers: { "X-RateLimit-Remaining": String(remaining) } },
      );
    }

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { message, history, existingNodes } = parsed.data;

    // WHY: Inject the user's social media context so the AI can give personalized advice.
    // e.g. "Based on your recent Instagram posts about sneakers..." instead of generic tips.
    let socialContext = "";
    try {
      socialContext = await buildUserContext(session.user.id ?? "");
    } catch (err) {
      console.error("[CreateContent] Failed to build social context:", err);
    }

    const systemPrompt = WORKSPACE_SYSTEM_PROMPT.replace(
      "{existingNodes}",
      existingNodes
        ? `${existingNodes.length} (${existingNodes.map((n) => `${n.type}: ${n.title}`).join(", ")})`
        : "0",
    ) + (socialContext
      ? `\n\nUser's social media context (use this to personalize your advice and content):\n${socialContext}`
      : "");

    // Build conversation history: compact old messages + append new user message
    const fullHistory: CompactableChatMessage[] = [
      ...(history ?? []),
      { role: "user" as const, content: message },
    ];
    const compactedHistory = compactMessages(fullHistory);

    const response = await claude.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: compactedHistory.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const fullText =
      response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n") || "";

    // Parse ```action blocks for agentic actions
    const actions: Array<Record<string, unknown>> = [];
    const actionPattern = /```action\s*([\s\S]*?)```/g;
    let actionMatch;
    while ((actionMatch = actionPattern.exec(fullText)) !== null) {
      try {
        const parsed = JSON.parse(actionMatch[1].trim());
        actions.push(parsed);
      } catch {
        // Skip malformed action blocks
      }
    }

    // Parse legacy ```json blocks for canvas nodes
    let nodes: unknown[] = [];
    const jsonMatch = fullText.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.nodes && Array.isArray(parsed.nodes)) {
          nodes = parsed.nodes.map((n: Record<string, unknown>) => {
            const node: Record<string, unknown> = {
              type: n.type ?? "copy",
              title: n.title ?? "Untitled",
              prompt: n.prompt ?? message,
              thumbnail: n.thumbnail ?? null,
            };

            // Handle video projects with scenes
            if (n.type === "video" && n.scenes && Array.isArray(n.scenes)) {
              node.videoProjectId = crypto.randomUUID();
              node.scenes = n.scenes;
            }

            return node;
          });
        }
      } catch {
        // JSON parse failed — no nodes, just use the message
      }
    }

    // Clean the message by removing action and json blocks
    const cleanMessage = fullText
      .replace(/```action\s*[\s\S]*?```/g, "")
      .replace(/```json\s*[\s\S]*?```/g, "")
      .trim();

    return NextResponse.json({
      message: cleanMessage,
      nodes,
      actions,
    });
  } catch (error) {
    console.error("Create content API error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 },
    );
  }
}
