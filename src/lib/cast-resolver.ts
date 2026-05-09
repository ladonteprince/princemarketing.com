// WHY: Backend @handle resolution. When a storyboard prompt contains @ladonte
// or @navy-suit, the resolver looks up the user's cast assets, appends each
// sheet URL to referenceImages[], and rewrites the prompt body to include the
// asset's canonical label + description so the model has both the visual ref
// and the textual context.

import { db } from "@/lib/db";
import type { AssetKind } from "@prisma/client";

const HANDLE_RE = /@([a-z][a-z0-9_-]{1,31})/gi;

const CAST_KINDS: AssetKind[] = [
  "CHARACTER_SHEET",
  "PROP_SHEET",
  "ENVIRONMENT_SHEET",
];

export type ResolveCastInput = {
  userId: string;
  prompt: string;
  // Optional pre-existing reference images on the scene — handles get
  // appended to this list, not replacing it.
  existingReferenceImages?: string[];
};

export type ResolveCastResult = {
  prompt: string;
  referenceImages: string[];
  resolvedHandles: string[];
  unresolvedHandles: string[];
};

// WHY: One DB hit per resolveCast call (not per handle) — we batch all handles
// from the prompt and look them up in a single findMany.
export async function resolveCast(
  input: ResolveCastInput,
): Promise<ResolveCastResult> {
  const { userId, prompt, existingReferenceImages = [] } = input;

  const matches = Array.from(prompt.matchAll(HANDLE_RE));
  const handles = Array.from(
    new Set(matches.map((m) => m[1].toLowerCase())),
  );

  if (handles.length === 0) {
    return {
      prompt,
      referenceImages: existingReferenceImages,
      resolvedHandles: [],
      unresolvedHandles: [],
    };
  }

  const assets = await db.asset.findMany({
    where: {
      userId,
      handle: { in: handles },
      kind: { in: CAST_KINDS },
    },
    select: {
      handle: true,
      kind: true,
      title: true,
      publicUrl: true,
      gcsUri: true,
      directorDefaults: true,
      metadata: true,
    },
  });

  const byHandle = new Map(
    assets.map((a) => [a.handle?.toLowerCase() ?? "", a]),
  );

  // WHY: Substitute @handle in the prompt body with the asset's label so the
  // model has prose context. The visual lock comes from referenceImages.
  // Unresolved handles (typos, deleted assets) stay as @handle untouched —
  // surfaced in unresolvedHandles so callers can warn.
  const resolvedHandles: string[] = [];
  const unresolvedHandles: string[] = [];
  let rewrittenPrompt = prompt.replace(HANDLE_RE, (full, h: string) => {
    const asset = byHandle.get(h.toLowerCase());
    if (!asset) {
      if (!unresolvedHandles.includes(h.toLowerCase())) {
        unresolvedHandles.push(h.toLowerCase());
      }
      return full;
    }
    if (!resolvedHandles.includes(h.toLowerCase())) {
      resolvedHandles.push(h.toLowerCase());
    }
    return asset.title ?? full;
  });

  // WHY: Append director defaults as a trailing clause so the model honors
  // them without the user having to remember IPA/FACS in every prompt.
  const directorClauses: string[] = [];
  for (const handle of resolvedHandles) {
    const a = byHandle.get(handle);
    if (!a) continue;
    const dd = (a.directorDefaults ?? {}) as Record<string, string>;
    const bits: string[] = [];
    if (dd.facs) bits.push(`face: ${dd.facs}`);
    if (dd.ipa) bits.push(`vocal phonemes: ${dd.ipa}`);
    if (dd.materialNotes) bits.push(`materials: ${dd.materialNotes}`);
    if (dd.moodNotes) bits.push(`mood: ${dd.moodNotes}`);
    if (dd.lightingNotes) bits.push(`lighting: ${dd.lightingNotes}`);
    if (bits.length) {
      directorClauses.push(`${a.title ?? handle}: ${bits.join("; ")}`);
    }
  }
  if (directorClauses.length) {
    rewrittenPrompt += `\n\nCharacter / asset defaults — ${directorClauses.join(". ")}.`;
  }

  // WHY: Asset references are added to existing scene refs, deduped, in the
  // order they appeared in the prompt.
  const sheetUrls: string[] = [];
  for (const handle of resolvedHandles) {
    const a = byHandle.get(handle);
    if (!a) continue;
    const url = a.publicUrl ?? a.gcsUri;
    if (url && !sheetUrls.includes(url)) sheetUrls.push(url);
  }

  const referenceImages = [
    ...existingReferenceImages,
    ...sheetUrls.filter((u) => !existingReferenceImages.includes(u)),
  ];

  return {
    prompt: rewrittenPrompt,
    referenceImages,
    resolvedHandles,
    unresolvedHandles,
  };
}
