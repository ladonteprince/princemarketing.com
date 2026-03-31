import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createEntrySchema } from "@/types/calendar";

// GET /api/calendar — List calendar entries with optional date range
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("start");
    const endDate = searchParams.get("end");

    const where: Record<string, unknown> = {};

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

// POST /api/calendar — Create a new calendar entry
export async function POST(request: Request) {
  try {
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
        userId: "mock-user-id",
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
