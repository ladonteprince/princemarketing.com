import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// WHY: Proxies scene enrichment requests to the .ai Gemini Director endpoint.
// The frontend calls /api/proxy/direct, this forwards to princemarketing.ai/api/v1/direct
// with the API key. Keeps the API key server-side and adds auth gating.

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const res = await fetch(
      `${process.env.PRINCE_API_URL || "https://princemarketing.ai"}/api/v1/direct`,
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
    console.error("[Proxy/Direct] Error:", error);
    return NextResponse.json(
      { error: "Director service unavailable" },
      { status: 502 },
    );
  }
}
