import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createEntrySchema } from "@/types/calendar";

// GET /api/calendar — List calendar entries for the authenticated user with optional date range
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("start");
    const endDate = searchParams.get("end");

    const where: Record<string, unknown> = {
      userId: session.user.id,
    };

    if (startDate && endDate) {
      where.scheduledAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const entries = await db.calendarEntry.findMany({
      where,
      orderBy: { scheduledAt: "asc" },
      take: 100,
    });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error("Calendar fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendar entries" },
      { status: 500 },
    );
  }
}

// POST /api/calendar — Create a new calendar entry for the authenticated user
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createEntrySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const entry = await db.calendarEntry.create({
      data: {
        userId: session.user.id,
        platform: parsed.data.platform,
        title: parsed.data.title,
        content: parsed.data.content,
        scheduledAt: new Date(parsed.data.scheduledAt),
        campaignId: parsed.data.campaignId,
      },
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error("Calendar entry create error:", error);
    return NextResponse.json(
      { error: "Failed to create calendar entry" },
      { status: 500 },
    );
  }
}

// DELETE /api/calendar — Delete a calendar entry
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Entry ID required" }, { status: 400 });
    }

    // Ensure the entry belongs to the user
    const entry = await db.calendarEntry.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    await db.calendarEntry.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Calendar entry delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete calendar entry" },
      { status: 500 },
    );
  }
}

// PATCH /api/calendar — Update a calendar entry
export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Entry ID required" }, { status: 400 });
    }

    // Ensure the entry belongs to the user
    const existing = await db.calendarEntry.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (updates.title) data.title = updates.title;
    if (updates.content) data.content = updates.content;
    if (updates.platform) data.platform = updates.platform;
    if (updates.scheduledAt) data.scheduledAt = new Date(updates.scheduledAt);
    if (updates.status) data.status = updates.status;

    const entry = await db.calendarEntry.update({
      where: { id },
      data,
    });

    return NextResponse.json({ entry });
  } catch (error) {
    console.error("Calendar entry update error:", error);
    return NextResponse.json(
      { error: "Failed to update calendar entry" },
      { status: 500 },
    );
  }
}
