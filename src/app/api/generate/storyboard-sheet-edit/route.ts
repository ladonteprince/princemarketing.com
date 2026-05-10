import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limiter";
import { resolveCast } from "@/lib/cast-resolver";
import { z } from "zod";

// WHY: Per-panel re-roll without losing the rest of the sheet. The
// /v1/images/edits API regenerates only the transparent regions of the mask
// while preserving opaque areas — perfect fit for "fix this one cell." Client
// builds a mask via buildPanelMask() (transparent target panel, opaque rest)
// and POSTs both the current sheet + mask + new prompt; we proxy to OpenAI
// and return the updated sheet as a data URL.

const dataUrlSchema = z
  .string()
  .regex(/^data:image\/(png|jpeg);base64,/, "must be a data: PNG or JPEG URL");

const annotationsSchema = z
  .object({
    body: z.string().max(400).optional(),
    camera: z.string().max(400).optional(),
    framing: z.string().max(400).optional(),
    lighting: z.string().max(400).optional(),
    vocal: z.string().max(400).optional(),
    ipa: z.string().max(400).optional(),
    facs: z.string().max(400).optional(),
  })
  .optional();

const schema = z.object({
  sheetImageDataUrl: dataUrlSchema,
  maskDataUrl: dataUrlSchema,
  panelIndex: z.number().int().min(0).max(15),
  panelPrompt: z.string().min(3).max(2000),
  annotations: annotationsSchema,
});

function decodeDataUrl(url: string): { buffer: Buffer; mime: string } {
  const m = url.match(/^data:(image\/(?:png|jpeg));base64,(.+)$/);
  if (!m) throw new Error("Invalid data URL");
  return { mime: m[1], buffer: Buffer.from(m[2], "base64") };
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email ?? session.user.id ?? "unknown";
    const { allowed, remaining } = checkRateLimit(`sheetedit:${email}`, 10);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again in a minute." },
        {
          status: 429,
          headers: { "X-RateLimit-Remaining": String(remaining) },
        },
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY not set on server" },
        { status: 500 },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // WHY: Resolve @handle in the panel prompt the same way the sheet route
    // does so cast references in the new prompt round-trip through cast-
    // resolver before reaching OpenAI.
    const userId = session.user.id;
    let resolvedPanelPrompt = parsed.data.panelPrompt;
    if (userId) {
      const r = await resolveCast({
        userId,
        prompt: parsed.data.panelPrompt,
      });
      resolvedPanelPrompt = r.prompt;
    }

    const annClause = (() => {
      const a = parsed.data.annotations;
      if (!a) return "";
      const parts: string[] = [];
      if (a.body) parts.push(`Body movement: ${a.body}.`);
      if (a.camera) parts.push(`Camera: ${a.camera}.`);
      if (a.framing) parts.push(`Framing: ${a.framing}.`);
      if (a.lighting) parts.push(`Lighting: ${a.lighting}.`);
      if (a.vocal) parts.push(`Vocal / emotional register: ${a.vocal}.`);
      if (a.facs) parts.push(`Facial expression (FACS): ${a.facs}.`);
      return parts.length ? " " + parts.join(" ") : "";
    })();

    // WHY: Edit prompt scopes the model's attention to the masked cell while
    // keeping the rest of the sheet visually consistent. Mention the panel
    // number explicitly so the model treats it as one cell of a sheet, not
    // the whole image.
    const editPrompt =
      `Update only panel ${parsed.data.panelIndex + 1} of this storyboard sheet. ` +
      `Match the existing rough-pencil drawing style, line weight, and panel border. ` +
      `New panel content: ${resolvedPanelPrompt.trim()}.${annClause}`;

    const sheet = decodeDataUrl(parsed.data.sheetImageDataUrl);
    const mask = decodeDataUrl(parsed.data.maskDataUrl);

    // WHY: OpenAI image-edits is multipart/form-data only. Build the form
    // server-side using Node's File-like Blob.
    const form = new FormData();
    form.append("model", "gpt-image-1");
    form.append(
      "image",
      new Blob([new Uint8Array(sheet.buffer)], { type: sheet.mime }),
      sheet.mime === "image/png" ? "sheet.png" : "sheet.jpg",
    );
    form.append(
      "mask",
      new Blob([new Uint8Array(mask.buffer)], { type: mask.mime }),
      "mask.png",
    );
    form.append("prompt", editPrompt);
    form.append("n", "1");

    const res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    const result = (await res.json()) as {
      data?: Array<{ url?: string; b64_json?: string }>;
      error?: { message?: string };
    };

    if (!res.ok) {
      return NextResponse.json(
        { error: result?.error?.message ?? `OpenAI returned ${res.status}` },
        { status: 502 },
      );
    }

    const datum = result.data?.[0];
    const imageUrl = datum?.b64_json
      ? `data:image/png;base64,${datum.b64_json}`
      : (datum?.url ?? null);

    if (!imageUrl) {
      return NextResponse.json(
        { error: "OpenAI returned no image data" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      model: "gpt-image-1-edit",
      panelIndex: parsed.data.panelIndex,
      imageUrl,
      promptUsed: editPrompt,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Sheet edit failed",
      },
      { status: 500 },
    );
  }
}
