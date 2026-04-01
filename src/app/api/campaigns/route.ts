import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createCampaignSchema } from "@/types/campaign";

// GET /api/campaigns — List authenticated user's campaigns
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const campaigns = await db.campaign.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error("Campaigns fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaigns" },
      { status: 500 },
    );
  }
}

// POST /api/campaigns — Create a new campaign for the authenticated user
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createCampaignSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const campaign = await db.campaign.create({
      data: {
        userId: session.user.id,
        name: parsed.data.name,
        description: parsed.data.description,
        goal: parsed.data.goal,
        status: parsed.data.status ?? "DRAFT",
        startDate: parsed.data.startDate
          ? new Date(parsed.data.startDate)
          : undefined,
        endDate: parsed.data.endDate
          ? new Date(parsed.data.endDate)
          : undefined,
        budget: parsed.data.budget,
      },
    });

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    console.error("Campaign create error:", error);
    return NextResponse.json(
      { error: "Failed to create campaign" },
      { status: 500 },
    );
  }
}
