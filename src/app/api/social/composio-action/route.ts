import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { executeComposioAction } from "@/lib/composio";

// WHY: Generic proxy for any Composio action (insights, comments, messaging, etc.).
// The AI Strategist uses this to execute actions not covered by composio-publish.

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { actionSlug, params } = await request.json();

  if (!actionSlug || typeof actionSlug !== "string") {
    return NextResponse.json(
      { error: "actionSlug is required and must be a string" },
      { status: 400 },
    );
  }

  const result = await executeComposioAction(actionSlug, params ?? {});
  return NextResponse.json(result);
}
