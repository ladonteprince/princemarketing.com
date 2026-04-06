import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limiter";
import { claude } from "@/lib/claude";
import { z } from "zod";

// WHY: Scene prompt revision endpoint. User watches a generated scene, gives
// feedback, and Claude merges that feedback into a revised prompt while
// preserving the original cinematic structure and image references (@image1...).
// Server-side only so the Anthropic API key never reaches the browser.

const schema = z.object({
  originalPrompt: z.string().min(1).max(8000),
  feedback: z.string().min(1).max(4000),
  sceneIndex: z.number().int().nonnegative().optional(),
  totalScenes: z.number().int().positive().optional(),
});

// WHY: Strict system prompt — Claude must return JSON only, must keep image
// refs intact, and must not bloat the prompt or strip cinematic detail.
const SYSTEM_PROMPT = `You are a video prompt revision specialist. The user generated a scene from the original prompt below, watched it, and gave feedback on what they want changed. Your job is to merge their feedback into a revised prompt that preserves what worked and fixes what didn't.

Rules:
- Keep the core subject, setting, and action from the original
- Apply the user's feedback precisely
- Don't strip references like @image1, @image2 etc — those are required
- Maintain the same level of cinematic detail (camera, lighting, composition)
- Be concise — same length as the original, not longer
- Do NOT explain your changes in the prompt itself

Return JSON only:
{
  "revisedPrompt": "the new prompt text",
  "reasoning": "one sentence explaining what changed"
}`;

export async function POST(request: Request) {
  try {
    // WHY: NextAuth gate — no anonymous access to paid Claude calls.
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // WHY: Per-user rate limit keyed by email so one user can't burn budget.
    const email = session.user.email ?? session.user.id ?? "unknown";
    const { allowed, remaining } = checkRateLimit(`revise:${email}`, 30);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again in a minute." },
        { status: 429, headers: { "X-RateLimit-Remaining": String(remaining) } },
      );
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { originalPrompt, feedback, sceneIndex, totalScenes } = parsed.data;

    // WHY: Optional context line helps Claude reason about pacing within a
    // multi-scene sequence (e.g. scene 3 of 8 should match neighbors).
    const contextLine =
      typeof sceneIndex === "number" && typeof totalScenes === "number"
        ? `\n\nContext: Scene ${sceneIndex + 1} of ${totalScenes}.`
        : "";

    const userMessage = `Original prompt: "${originalPrompt}"

User feedback: "${feedback}"${contextLine}

Return the revised prompt as JSON.`;

    // WHY: Sonnet 4 with tight token cap — revisions should be similar in
    // length to the original, never sprawling. 512 tokens is plenty for the
    // revised prompt + one-line reasoning.
    const response = await claude.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    // WHY: Anthropic returns a content array of typed blocks; we only care
    // about the first text block.
    const textBlock = response.content.find((b) => b.type === "text");
    const rawText = textBlock && "text" in textBlock ? textBlock.text : "";

    if (!rawText) {
      return NextResponse.json(
        { error: "Empty response from Claude" },
        { status: 502 },
      );
    }

    // WHY: Claude sometimes wraps JSON in ```json fences despite instructions.
    // Strip fences and extract the first {...} block defensively before parse.
    const cleaned = rawText
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");
    const jsonSlice =
      jsonStart >= 0 && jsonEnd > jsonStart
        ? cleaned.slice(jsonStart, jsonEnd + 1)
        : cleaned;

    let parsedJson: { revisedPrompt?: unknown; reasoning?: unknown };
    try {
      parsedJson = JSON.parse(jsonSlice);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse Claude response", raw: rawText },
        { status: 502 },
      );
    }

    const revisedPrompt =
      typeof parsedJson.revisedPrompt === "string"
        ? parsedJson.revisedPrompt.trim()
        : "";
    const reasoning =
      typeof parsedJson.reasoning === "string"
        ? parsedJson.reasoning.trim()
        : "";

    if (!revisedPrompt) {
      return NextResponse.json(
        { error: "Claude returned no revisedPrompt" },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { revisedPrompt, reasoning },
      { headers: { "X-RateLimit-Remaining": String(remaining) } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Scene prompt revision failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
