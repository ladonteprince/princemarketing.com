import { NextRequest, NextResponse } from "next/server";

// Proxy media (images + videos) from princemarketing.ai to avoid CORS issues
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url || !url.startsWith("https://princemarketing.ai/")) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    const contentLength = response.headers.get("content-length");

    // For videos, stream the response instead of buffering entire file
    if (contentType.startsWith("video/") && response.body) {
      const headers: Record<string, string> = {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
        "Accept-Ranges": "bytes",
      };
      if (contentLength) headers["Content-Length"] = contentLength;

      return new NextResponse(response.body, { headers });
    }

    // For images, buffer and return
    const buffer = await response.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch media" }, { status: 502 });
  }
}
