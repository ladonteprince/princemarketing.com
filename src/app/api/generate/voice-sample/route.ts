import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// WHY: Auth-gated proxy streaming ElevenLabs voice samples from .ai.
// Browser-level caching is handled by the upstream response headers.

const API_BASE = process.env.PRINCE_API_URL || "https://princemarketing.ai";
const API_KEY = process.env.PRINCE_API_KEY || "";

const ALLOWED_VOICE_IDS = new Set([
  "21m00Tcm4TlvDq8ikWAM",
  "pNInz6obpgDQGcFmaJgB",
  "AZnzlk1XvdvUeBnXmlld",
]);

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const voiceId = searchParams.get("voiceId") ?? "";
    if (!ALLOWED_VOICE_IDS.has(voiceId)) {
      return NextResponse.json({ error: "Unknown voice" }, { status: 400 });
    }

    const res = await fetch(
      `${API_BASE}/api/v1/generate/voice-sample?voiceId=${voiceId}`,
      {
        headers: { "x-api-key": API_KEY },
      },
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "Sample unavailable" },
        { status: res.status },
      );
    }

    // Stream the audio bytes back to the client unchanged so the browser
    // can use the response URL directly as an Audio element src.
    const buffer = await res.arrayBuffer();
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (err) {
    console.error("[VoiceSample] Error:", err);
    return NextResponse.json({ error: "Sample failed" }, { status: 500 });
  }
}
