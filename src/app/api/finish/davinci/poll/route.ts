import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// WHY: The Mac-local DaVinci agent polls this endpoint to claim queued jobs.
// Auth is via the FINISHING_AGENT_TOKEN bearer (shared secret in .env on
// both VPS and the user's Mac). NOT the user session — the agent runs
// headless without browser auth.
//
// Behavior: atomically transition the oldest QUEUED job to IN_PROGRESS and
// return it. Returns 204 No Content if nothing to claim. The agent should
// poll on a 30-60s interval.

export async function GET(request: Request) {
  const tokenExpected = process.env.FINISHING_AGENT_TOKEN;
  if (!tokenExpected) {
    return NextResponse.json(
      { error: "FINISHING_AGENT_TOKEN not configured on server" },
      { status: 500 },
    );
  }

  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!token || token !== tokenExpected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // WHY: Use a transaction with FOR UPDATE SKIP LOCKED semantics so two
    // agents (a future possibility) never claim the same job. Prisma's
    // raw $transaction + UPDATE...RETURNING does the same thing in one
    // round-trip.
    const claimed = await db.$queryRawUnsafe<
      Array<{
        id: string;
        userId: string;
        projectId: string | null;
        spec: unknown;
        createdAt: Date;
      }>
    >(`
      UPDATE finishing_jobs
      SET status = 'IN_PROGRESS', "startedAt" = NOW(), "updatedAt" = NOW()
      WHERE id = (
        SELECT id FROM finishing_jobs
        WHERE status = 'QUEUED'
        ORDER BY "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING id, "userId", "projectId", spec, "createdAt"
    `);

    if (!claimed.length) {
      return new Response(null, { status: 204 });
    }

    const job = claimed[0];
    return NextResponse.json({
      jobId: job.id,
      userId: job.userId,
      projectId: job.projectId,
      spec: job.spec,
      createdAt: job.createdAt,
    });
  } catch (err) {
    console.error("[FinishPoll] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Poll failed" },
      { status: 500 },
    );
  }
}
