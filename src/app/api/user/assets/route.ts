import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { princeAPI } from "@/lib/api-client";
import type { Generation } from "@/lib/api-client";

// WHY: Proxies to princemarketing.ai to fetch the user's generation history.
// Transforms the .ai response into a normalized Asset format for the frontend grid.

type Asset = {
  id: string;
  type: "image" | "video" | "audio" | "copy";
  status: string;
  url?: string;
  content?: string;
  prompt: string;
  createdAt: string;
  score?: number;
};

function normalizeType(raw: string): Asset["type"] {
  const lower = raw.toLowerCase();
  if (lower.includes("image")) return "image";
  if (lower.includes("video")) return "video";
  if (lower.includes("audio") || lower.includes("music")) return "audio";
  return "copy";
}

function generationToAsset(gen: Generation): Asset {
  return {
    id: gen.id,
    type: normalizeType(gen.type),
    status: gen.status,
    url: gen.resultUrl,
    prompt: gen.prompt,
    createdAt: gen.createdAt,
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limitParam = request.nextUrl.searchParams.get("limit");
    const offsetParam = request.nextUrl.searchParams.get("offset");
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 200) : 50;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

    const result = await princeAPI.getGenerations({ limit, offset }) as any;

    // Unwrap .ai API envelope: { type: "success", data: { generations: [...] } }
    const inner = result?.data ?? result;
    const generations = inner?.generations ?? [];
    const total = inner?.pagination?.total ?? generations.length;

    const assets: Asset[] = generations.map((g: any) => generationToAsset({
      id: g.id,
      type: g.type ?? "image",
      status: g.status ?? "passed",
      prompt: g.prompt ?? "",
      resultUrl: g.resultUrl ?? g.result_url,
      createdAt: g.createdAt ?? g.created_at ?? new Date().toISOString(),
    }));

    return NextResponse.json({
      assets,
      total,
    });
  } catch (error) {
    console.error("[UserAssets] Failed to fetch generations:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch assets";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
