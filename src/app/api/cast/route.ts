import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import type { AssetKind } from "@prisma/client";

// WHY: Cast / props / environments — the production library. Each row is an
// Asset with kind in {CHARACTER_SHEET, PROP_SHEET, ENVIRONMENT_SHEET}, a
// stable per-user @handle, and a canonical reference-sheet URL. Storyboard
// prompts can pull these in by handle for visual lock across panels.

const CAST_KIND_BY_CATEGORY: Record<
  "character" | "prop" | "environment",
  AssetKind
> = {
  character: "CHARACTER_SHEET",
  prop: "PROP_SHEET",
  environment: "ENVIRONMENT_SHEET",
};

// WHY: Slug rules — lowercase letters, digits, hyphen, underscore. 2–32 chars.
// Prompt-readable, URL-safe, easy to type. No leading digit (would parse weird).
const handleSchema = z
  .string()
  .min(2)
  .max(32)
  .regex(/^[a-z][a-z0-9_-]*$/i, "Handle must start with a letter and use only letters, digits, _ or -")
  .transform((v) => v.toLowerCase());

const directorDefaultsSchema = z
  .object({
    ipa: z.string().max(400).optional(),
    facs: z.string().max(400).optional(),
    materialNotes: z.string().max(400).optional(),
    moodNotes: z.string().max(400).optional(),
    lightingNotes: z.string().max(400).optional(),
  })
  .optional()
  .default({});

const createSchema = z.object({
  handle: handleSchema,
  category: z.enum(["character", "prop", "environment"]),
  label: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  // WHY: The canonical sheet URL — usually returned from
  // /api/generate/reference-sheet (Nano Banana Pro multi-angle turnaround).
  // Stored as both gcsUri and publicUrl since it's already an HTTPS URL.
  sheetImageUrl: z.string().url(),
  sourcePhotoUrls: z.array(z.string().url()).max(20).optional().default([]),
  directorDefaults: directorDefaultsSchema,
  projectId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  if (!userId) {
    return NextResponse.json({ error: "No user id on session" }, { status: 401 });
  }

  const categoryParam = request.nextUrl.searchParams.get("category") as
    | "character"
    | "prop"
    | "environment"
    | null;

  const where = {
    userId,
    kind: categoryParam
      ? { equals: CAST_KIND_BY_CATEGORY[categoryParam] }
      : {
          in: [
            "CHARACTER_SHEET",
            "PROP_SHEET",
            "ENVIRONMENT_SHEET",
          ] as AssetKind[],
        },
  };

  const assets = await db.asset.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      handle: true,
      kind: true,
      title: true,
      gcsUri: true,
      publicUrl: true,
      directorDefaults: true,
      metadata: true,
      projectId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // WHY: Frontend wants a flat shape with category back instead of kind enum.
  const KIND_TO_CATEGORY: Record<string, "character" | "prop" | "environment"> = {
    CHARACTER_SHEET: "character",
    PROP_SHEET: "prop",
    ENVIRONMENT_SHEET: "environment",
  };

  return NextResponse.json({
    cast: assets.map((a) => ({
      id: a.id,
      handle: a.handle,
      category: KIND_TO_CATEGORY[a.kind] ?? "character",
      label: a.title,
      sheetImageUrl: a.publicUrl ?? a.gcsUri,
      sourcePhotoUrls:
        (a.metadata as Record<string, unknown>)?.sourcePhotoUrls ?? [],
      description: (a.metadata as Record<string, unknown>)?.description ?? null,
      directorDefaults: a.directorDefaults,
      projectId: a.projectId,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    })),
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  if (!userId) {
    return NextResponse.json({ error: "No user id on session" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { handle, category, label, description, sheetImageUrl, sourcePhotoUrls, directorDefaults, projectId } =
    parsed.data;

  // WHY: Prevent duplicate handles per user. The unique constraint on
  // (userId, handle) would throw at create-time, but a friendlier error here.
  const existing = await db.asset.findFirst({
    where: { userId, handle },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Handle @${handle} is already taken on your account.` },
      { status: 409 },
    );
  }

  const asset = await db.asset.create({
    data: {
      userId,
      kind: CAST_KIND_BY_CATEGORY[category],
      handle,
      title: label,
      gcsUri: sheetImageUrl,
      publicUrl: sheetImageUrl,
      directorDefaults: directorDefaults ?? {},
      projectId: projectId ?? null,
      metadata: {
        sourcePhotoUrls,
        description: description ?? null,
      },
    },
    select: {
      id: true,
      handle: true,
      kind: true,
      title: true,
      publicUrl: true,
      gcsUri: true,
      directorDefaults: true,
      metadata: true,
      projectId: true,
      createdAt: true,
    },
  });

  return NextResponse.json(
    {
      cast: {
        id: asset.id,
        handle: asset.handle,
        category,
        label: asset.title,
        sheetImageUrl: asset.publicUrl ?? asset.gcsUri,
        sourcePhotoUrls,
        description: description ?? null,
        directorDefaults: asset.directorDefaults,
        projectId: asset.projectId,
        createdAt: asset.createdAt,
      },
    },
    { status: 201 },
  );
}
