import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limiter";

// WHY: Proxy route checks NextAuth session then forwards audio upload to .ai.
// Audio files need to be accessible by the .ai backend for stitch operations.

const API_BASE = process.env.PRINCE_API_URL || "https://princemarketing.ai";
const API_KEY = process.env.PRINCE_API_KEY || "";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email ?? session.user.id ?? "unknown";
    const { allowed } = checkRateLimit(`upload-audio:${email}`, 15);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again in a minute." },
        { status: 429 },
      );
    }

    // Forward the multipart form data directly to .ai
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 },
      );
    }

    // Rebuild form data for .ai
    const forwardData = new FormData();
    forwardData.append("file", file);

    const res = await fetch(`${API_BASE}/api/v1/upload/audio`, {
      method: "POST",
      headers: {
        "x-api-key": API_KEY,
      },
      body: forwardData,
    });

    const result = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: result?.error?.message ?? "Upload failed" },
        { status: res.status },
      );
    }

    // Return the permanent audio URL
    return NextResponse.json({
      audioUrl: result?.data?.audioUrl,
      fileName: result?.data?.fileName,
      size: result?.data?.size,
    });
  } catch (error) {
    console.error("Audio upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload audio" },
      { status: 500 },
    );
  }
}
