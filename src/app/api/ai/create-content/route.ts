import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { claude, STRATEGIST_SYSTEM_PROMPT } from "@/lib/claude";
import { checkRateLimit } from "@/lib/rate-limiter";
import { z } from "zod";

const requestSchema = z.object({
  sessionId: z.string(),
  message: z.string().min(1),
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

const WORKSPACE_SYSTEM_PROMPT = `${STRATEGIST_SYSTEM_PROMPT}

You are now operating in the Creative Workspace mode. When the user asks you to create content, you must respond with BOTH:
1. A conversational message explaining what you created
2. A JSON block at the end of your response wrapped in \`\`\`json ... \`\`\` that describes the nodes to create on the canvas

The JSON block should be an array of objects with this shape:
{
  "nodes": [
    {
      "type": "image" | "video" | "copy" | "post",
      "title": "Short descriptive title",
      "prompt": "The generation prompt for this piece of content",
      "thumbnail": null
    }
  ]
}

For video requests, break the video into multiple scenes and return:
{
  "nodes": [
    {
      "type": "video",
      "title": "Video project title",
      "prompt": "Overall video concept",
      "videoProjectId": "auto",
      "scenes": [
        { "prompt": "Scene 1 description", "duration": 5 },
        { "prompt": "Scene 2 description", "duration": 5 }
      ]
    }
  ]
}

For campaign requests, return multiple nodes of different types (image, copy, video, post) that form a connected pipeline.

If the user is just chatting or asking questions (not requesting content creation), respond normally WITHOUT a JSON block.

Current canvas state: The user has ${"{existingNodes}"} content nodes on their canvas.`;

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

    const { message, existingNodes } = parsed.data;

    const systemPrompt = WORKSPACE_SYSTEM_PROMPT.replace(
      "{existingNodes}",
      existingNodes
        ? `${existingNodes.length} (${existingNodes.map((n) => `${n.type}: ${n.title}`).join(", ")})`
        : "0",
    );

    const response = await claude.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: message,
        },
      ],
    });

    const fullText =
      response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n") || "";

    // Parse JSON block from response
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

    // Clean the message by removing the JSON block
    const cleanMessage = fullText.replace(/```json\s*[\s\S]*?```/g, "").trim();

    return NextResponse.json({
      message: cleanMessage,
      nodes,
    });
  } catch (error) {
    console.error("Create content API error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 },
    );
  }
}
