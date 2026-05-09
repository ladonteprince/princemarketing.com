import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const handleSchema = z
  .string()
  .min(2)
  .max(32)
  .regex(/^[a-z][a-z0-9_-]*$/i, "Handle must start with a letter and use only letters, digits, _ or -")
  .transform((v) => v.toLowerCase());

const updateSchema = z.object({
  handle: handleSchema.optional(),
  label: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
  directorDefaults: z
    .object({
      ipa: z.string().max(400).optional(),
      facs: z.string().max(400).optional(),
      materialNotes: z.string().max(400).optional(),
      moodNotes: z.string().max(400).optional(),
      lightingNotes: z.string().max(400).optional(),
    })
    .optional(),
  sheetImageUrl: z.string().url().optional(),
});

async function ownedByUser(id: string, userId: string) {
  const a = await db.asset.findUnique({
    where: { id },
    select: { userId: true },
  });
  return a?.userId === userId;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  if (!userId) {
    return NextResponse.json({ error: "No user id on session" }, { status: 401 });
  }
  const { id } = await params;

  const asset = await db.asset.findFirst({
    where: { id, userId },
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
  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ cast: asset });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  if (!userId) {
    return NextResponse.json({ error: "No user id on session" }, { status: 401 });
  }
  const { id } = await params;
  if (!(await ownedByUser(id, userId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existing = await db.asset.findUnique({
    where: { id },
    select: { metadata: true },
  });
  const existingMeta = (existing?.metadata as Record<string, unknown>) ?? {};

  const data: Record<string, unknown> = {};
  if (parsed.data.handle !== undefined) {
    // WHY: Detect collision before the unique constraint throws an opaque error.
    const clash = await db.asset.findFirst({
      where: { userId, handle: parsed.data.handle, NOT: { id } },
      select: { id: true },
    });
    if (clash) {
      return NextResponse.json(
        { error: `Handle @${parsed.data.handle} is already taken.` },
        { status: 409 },
      );
    }
    data.handle = parsed.data.handle;
  }
  if (parsed.data.label !== undefined) data.title = parsed.data.label;
  if (parsed.data.description !== undefined) {
    data.metadata = { ...existingMeta, description: parsed.data.description };
  }
  if (parsed.data.directorDefaults !== undefined) {
    data.directorDefaults = parsed.data.directorDefaults;
  }
  if (parsed.data.sheetImageUrl !== undefined) {
    data.gcsUri = parsed.data.sheetImageUrl;
    data.publicUrl = parsed.data.sheetImageUrl;
  }

  const updated = await db.asset.update({
    where: { id },
    data,
    select: {
      id: true,
      handle: true,
      kind: true,
      title: true,
      publicUrl: true,
      gcsUri: true,
      directorDefaults: true,
      metadata: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ cast: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  if (!userId) {
    return NextResponse.json({ error: "No user id on session" }, { status: 401 });
  }
  const { id } = await params;
  if (!(await ownedByUser(id, userId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.asset.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
