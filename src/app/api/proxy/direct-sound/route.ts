import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// WHY: Proxies sound direction requests to the .ai Gemini Sound Director.
// After video is stitched, the frontend calls this to get a neurochemically-
// targeted Sound Skeleton + Suno prompt for music generation.

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const res = await fetch(
      `${process.env.PRINCE_API_URL || "https://princemarketing.ai"}/api/v1/direct/sound`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.PRINCE_API_KEY || "",
        },
        body: JSON.stringify(body),
      },
    );

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("[Proxy/DirectSound] Error:", error);
    return NextResponse.json(
      { error: "Sound Director service unavailable" },
      { status: 502 },
    );
  }
}
