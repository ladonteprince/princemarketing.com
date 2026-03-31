import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createCampaignSchema } from "@/types/campaign";

// GET /api/campaigns — List user's campaigns
export async function GET() {
  try {
    // WHY: In production, get userId from session cookie. Using mock for initial build.
    const campaigns = await db.campaign.findMany({
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

// POST /api/campaigns — Create a new campaign
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createCampaignSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    // WHY: userId would come from authenticated session in production
    const campaign = await db.campaign.create({
      data: {
        userId: "mock-user-id",
        name: parsed.data.name,
        description: parsed.data.description,
        goal: parsed.data.goal,
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
