import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasFeature } from "@/lib/feature-flags";

// POST /api/calendar/:id/approve — Approve a calendar entry (DRAFT → SCHEDULED)
// Body: { action: "approve" } or { action: "reject", feedback: "..." }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userTier = (session.user as { tier?: string }).tier ?? "STARTER";

    // Check if user has access to approval workflow
    if (!hasFeature(userTier, "approval_workflow")) {
      return NextResponse.json(
        { error: "Approval workflow is not available on your current plan. Upgrade to Scale to access this feature." },
        { status: 403 },
      );
    }

    const { id } = await params;
    const body = await request.json();
    const action = body.action as string;

    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'approve' or 'reject'." },
        { status: 400 },
      );
    }

    // Find the entry and ensure it belongs to the user
    const entry = await db.calendarEntry.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    if (action === "approve") {
      // Only DRAFT entries can be approved
      if (entry.status !== "DRAFT") {
        return NextResponse.json(
          { error: `Cannot approve entry with status '${entry.status}'. Only DRAFT entries can be approved.` },
          { status: 400 },
        );
      }

      const updated = await db.calendarEntry.update({
        where: { id },
        data: { status: "SCHEDULED" },
      });

      return NextResponse.json({
        entry: updated,
        message: "Entry approved and scheduled for publishing.",
      });
    }

    // action === "reject"
    if (entry.status !== "DRAFT" && entry.status !== "SCHEDULED") {
      return NextResponse.json(
        { error: `Cannot reject entry with status '${entry.status}'. Only DRAFT or SCHEDULED entries can be rejected.` },
        { status: 400 },
      );
    }

    const feedback = body.feedback as string | undefined;

    const updated = await db.calendarEntry.update({
      where: { id },
      data: { status: "DRAFT" },
    });

    return NextResponse.json({
      entry: updated,
      feedback: feedback ?? null,
      message: "Entry rejected and moved back to draft.",
    });
  } catch (error) {
    console.error("Calendar approval error:", error);
    return NextResponse.json(
      { error: "Failed to process approval action" },
      { status: 500 },
    );
  }
}
