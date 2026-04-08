import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limiter";
import { z } from "zod";

// WHY: When the user picks a product from the inline product picker, we
// want to persist that image into their asset library so they can recall
// it via @-mention in future projects. The external URL (hodinkee.com,
// tomford.com, etc.) isn't stable — so we fetch it server-side, re-upload
// through the existing .ai upload pipeline, and return the new stable URL
// plus the Generation record ID that the frontend can use as a reference.

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const schema = z.object({
  url: z.string().url(),
  label: z.string().max(100),
  category: z.enum(["character", "prop", "scene"]).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email ?? session.user.id ?? "unknown";
    const { allowed } = checkRateLimit(`upload-url:${email}`, 30);
    if (!allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Fetch the remote image with a timeout.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    let imageRes: Response;
    try {
      imageRes = await fetch(parsed.data.url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
      });
    } finally {
      clearTimeout(timer);
    }

    if (!imageRes.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${imageRes.status}` },
        { status: 502 },
      );
    }

    const contentType = imageRes.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json(
        { error: "URL did not return an image" },
        { status: 400 },
      );
    }

    const buffer = await imageRes.arrayBuffer();
    if (buffer.byteLength > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Image too large (max 25MB)" },
        { status: 400 },
      );
    }

    // Pick a filename from the URL path or fall back to the label.
    let filename = parsed.data.label.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    try {
      const urlPath = new URL(parsed.data.url).pathname;
      const last = urlPath.split("/").pop() ?? "";
      if (last && /\.(jpe?g|png|webp|gif)$/i.test(last)) filename = last;
    } catch {
      /* ignore */
    }
    if (!/\.(jpe?g|png|webp|gif)$/i.test(filename)) {
      const ext = contentType.split("/")[1] ?? "jpg";
      filename = `${filename}.${ext}`;
    }

    const file = new File([buffer], filename, { type: contentType });
    const apiKey = process.env.PRINCE_API_KEY ?? "";
    const apiUrl = process.env.PRINCE_API_URL ?? "https://princemarketing.ai";

    const forwardForm = new FormData();
    forwardForm.append("file", file);
    forwardForm.append("label", parsed.data.label);
    if (parsed.data.category) forwardForm.append("category", parsed.data.category);

    const res = await fetch(`${apiUrl}/api/v1/upload/image`, {
      method: "POST",
      headers: { "x-api-key": apiKey },
      body: forwardForm,
    });

    const data = await res.json();
    return NextResponse.json(
      {
        ...data,
        label: parsed.data.label,
        category: parsed.data.category,
      },
      { status: res.status },
    );
  } catch (error) {
    console.error("[Upload/ImageFromUrl] Error:", error);
    const isAbort = error instanceof Error && error.name === "AbortError";
    return NextResponse.json(
      { error: isAbort ? "Fetch timed out" : "Upload failed" },
      { status: isAbort ? 504 : 500 },
    );
  }
}
