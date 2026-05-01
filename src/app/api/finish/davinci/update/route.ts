import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

// WHY: The Mac-local DaVinci agent posts updates here while it works on a
// claimed job. Same FINISHING_AGENT_TOKEN bearer auth as /poll. The agent
// can post intermediate progress (kept in `result.progress`) and a final
// completion or failure record.
//
// Job lifecycle: QUEUED → claimed by /poll → IN_PROGRESS → /update with
// status=COMPLETE (and `result` populated) OR status=FAILED (and `error`
// populated). After terminal status the row stays for audit/history.

const requestSchema = z.object({
  jobId: z.string().min(1),
  status: z.enum(["IN_PROGRESS", "COMPLETE", "FAILED"]),
  result: z.unknown().optional(),
  error: z.string().max(2000).optional(),
  agentVersion: z.string().max(50).optional(),
});

export async function POST(request: Request) {
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
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { jobId, status, result, error: errMsg, agentVersion } = parsed.data;

    const data: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
    };
    if (result !== undefined) {
      data.result = result as object;
    }
    if (errMsg !== undefined) {
      data.error = errMsg;
    }
    if (agentVersion !== undefined) {
      data.agentVersion = agentVersion;
    }
    if (status === "COMPLETE" || status === "FAILED") {
      data.completedAt = new Date();
    }

    const updated = await db.finishingJob.update({
      where: { id: jobId },
      data: data as never,
      select: { id: true, status: true, updatedAt: true },
    });

    return NextResponse.json({
      jobId: updated.id,
      status: updated.status,
      updatedAt: updated.updatedAt,
    });
  } catch (err) {
    console.error("[FinishUpdate] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 },
    );
  }
}
