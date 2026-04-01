import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

// GET /api/stream/:id — SSE proxy to princemarketing.ai generation stream
// WHY: Proxies the .ai SSE endpoint so the frontend never sees the API key.
// The client opens one connection and gets real-time progress until completion.

const API_BASE = process.env.PRINCE_API_URL || "https://princemarketing.ai";
const API_KEY = process.env.PRINCE_API_KEY || "";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { id } = await params;

  // Proxy SSE connection to .ai backend
  const upstream = await fetch(`${API_BASE}/api/v1/generations/${id}/stream`, {
    headers: {
      "x-api-key": API_KEY,
      Accept: "text/event-stream",
    },
    signal: request.signal,
  });

  if (!upstream.ok || !upstream.body) {
    const errorBody = await upstream.text().catch(() => "Stream unavailable");
    return new Response(JSON.stringify({ error: errorBody }), {
      status: upstream.status || 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Pass through the SSE stream
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
