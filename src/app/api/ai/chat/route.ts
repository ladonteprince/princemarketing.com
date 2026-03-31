import { NextResponse } from "next/server";
import { claude, STRATEGIST_SYSTEM_PROMPT } from "@/lib/claude";
import { z } from "zod";

const chatRequestSchema = z.object({
  sessionId: z.string(),
  message: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    // 1. Parse request
    const body = await request.json();
    const parsed = chatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 },
      );
    }

    const { message } = parsed.data;

    // 2. Create streaming response from Claude
    const stream = await claude.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: STRATEGIST_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: message,
        },
      ],
    });

    // 3. Convert to SSE stream
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const data = `data: ${event.delta.text}\n\n`;
              controller.enqueue(encoder.encode(data));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          console.error("Stream error:", error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: "Stream interrupted" })}\n\n`,
            ),
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 },
    );
  }
}
