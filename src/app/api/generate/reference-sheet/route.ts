import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limiter";
import { z } from "zod";

// WHY: Proxy route for multi-angle reference sheet generation. Takes already-uploaded
// image URLs as the source of truth for likeness/shape/atmosphere, builds a category-
// specific Nano Banana Pro prompt, and forwards to the .ai backend. API key never
// leaves the server. Returns generationId + streamUrl for SSE polling, mirroring
// /api/generate/image's response shape.

const API_BASE = process.env.PRINCE_API_URL || "https://princemarketing.ai";
const API_KEY = process.env.PRINCE_API_KEY || "";

// WHY: 1-20 image cap matches Nano Banana Pro's reference image limits and keeps
// payloads sane. Category drives the prompt template selection.
const schema = z.object({
  imageUrls: z.array(z.string().url()).min(1).max(20),
  category: z.enum(["character", "prop", "environment"]),
  label: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
});

type ReferenceSheetInput = z.infer<typeof schema>;

// WHY: Each category needs a different turnaround/layout. Characters need a 3-pose
// turnaround for face swap consistency, props need 4 product views, environments
// need a panoramic spatial reference. Source photos are explicitly anchored as
// "source of truth" so Nano Banana Pro preserves likeness instead of inventing.
function buildPrompt({ category, label, description }: ReferenceSheetInput): string {
  const tail = description ? ` ${description}` : "";

  switch (category) {
    case "character":
      return (
        "Multi-angle character reference sheet using these uploaded photos as the " +
        "source of truth for facial features, hair, build, and clothing. Generate " +
        "a turnaround view: front view (center), three-quarter view (left), side " +
        "profile (right). Maintain exact likeness from the source photos. White " +
        "background, clean studio lighting, fashion illustration style. " +
        `Subject: ${label}.${tail}`
      );
    case "prop":
      return (
        "Multi-angle product reference sheet using these uploaded photos as the " +
        "source of truth for shape, color, texture, and proportions. Generate four " +
        "views: front (top-left), side (top-right), back (bottom-left), detail " +
        "close-up (bottom-right). Maintain exact appearance from source photos. " +
        "White background, clean studio lighting, product photography style. " +
        `Product: ${label}.${tail}`
      );
    case "environment":
      return (
        "Multi-angle environment reference sheet using these uploaded photos as " +
        "the source of truth for architecture, lighting, color palette, and " +
        "atmosphere. Generate a panoramic view showing the full space from " +
        "multiple angles. Maintain exact look from source photos. " +
        `Location: ${label}.${tail}`
      );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email ?? session.user.id ?? "unknown";
    // WHY: Lower limit (10/min) than image (20) because reference sheets are heavier
    // multi-image generations on the .ai side.
    const { allowed, remaining } = checkRateLimit(`reference:${email}`, 10);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again in a minute." },
        { status: 429, headers: { "X-RateLimit-Remaining": String(remaining) } },
      );
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const prompt = buildPrompt(parsed.data);

    // WHY: Direct fetch (not princeAPI client) so we can pass through the 202
    // generationId envelope just like the video route does — reference sheets are
    // async on the .ai side and stream progress over /api/stream/{id}.
    const res = await fetch(`${API_BASE}/api/v1/generate/image`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify({
        prompt,
        style: "reference-sheet",
        referenceImages: parsed.data.imageUrls,
        model: "nano-banana-pro",
        qualityTier: "pro",
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: result?.error?.message ?? "Reference sheet generation failed" },
        { status: res.status },
      );
    }

    // WHY: Mirror the image route's unwrap of the .ai { type, data } envelope so
    // synchronous results return inline, while async results return a streamUrl
    // for the client to subscribe to.
    const inner = (result?.data ?? result) as Record<string, unknown>;
    const generationId =
      (inner.generationId as string | undefined) ??
      (result?.meta?.generationId as string | undefined);

    return NextResponse.json(
      {
        generationId,
        status: inner.status ?? "processing",
        imageUrl: inner.imageUrl ?? inner.resultUrl ?? null,
        url: inner.imageUrl ?? inner.resultUrl ?? null,
        refinedPrompt: inner.refinedPrompt ?? prompt,
        category: parsed.data.category,
        label: parsed.data.label,
        sourceImageCount: parsed.data.imageUrls.length,
        streamUrl: generationId ? `/api/stream/${generationId}` : null,
        pollUrl: generationId ? `/api/stream/${generationId}` : null,
      },
      { status: res.status },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Reference sheet generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
