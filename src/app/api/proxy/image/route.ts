import { NextRequest, NextResponse } from "next/server";

// Proxy media (images + videos) from princemarketing.ai to avoid CORS issues
// Supports HTTP Range requests for proper video seeking/playback
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url || !url.startsWith("https://princemarketing.ai/")) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const rangeHeader = request.headers.get("range");

    // Forward Range header to upstream if present (needed for video seeking)
    const fetchHeaders: Record<string, string> = {};
    if (rangeHeader) {
      fetchHeaders["Range"] = rangeHeader;
    }

    const response = await fetch(url, { headers: fetchHeaders });
    if (!response.ok && response.status !== 206) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    const contentLength = response.headers.get("content-length");
    const contentRange = response.headers.get("content-range");

    // For videos, support Range requests for proper HTML5 video playback
    if (contentType.startsWith("video/")) {
      const headers: Record<string, string> = {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
        "Accept-Ranges": "bytes",
      };
      if (contentLength) headers["Content-Length"] = contentLength;
      if (contentRange) headers["Content-Range"] = contentRange;

      // 206 Partial Content for range requests, 200 for full requests
      const status = response.status === 206 ? 206 : 200;

      if (response.body) {
        return new NextResponse(response.body, { status, headers });
      }
      const buffer = await response.arrayBuffer();
      return new NextResponse(buffer, { status, headers });
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
