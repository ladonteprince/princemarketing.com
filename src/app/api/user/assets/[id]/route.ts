import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// WHY: Proxies DELETE/PATCH to princemarketing.ai for generation management.
// Keeps API keys server-side only.

const API_BASE = process.env.PRINCE_API_URL || "https://princemarketing.ai";
const API_KEY = process.env.PRINCE_API_KEY || "";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const res = await fetch(`${API_BASE}/api/v1/generations/${id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        (body as { error?: string }).error ??
          `princemarketing.ai responded with ${res.status}`,
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[UserAssets] Failed to delete generation:", error);
    const message =
      error instanceof Error ? error.message : "Failed to delete asset";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH — update generation metadata (e.g. category tag)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const res = await fetch(`${API_BASE}/api/v1/generations/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("[UserAssets] Failed to update generation:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update asset";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
