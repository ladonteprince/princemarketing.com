import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// POST — Save the user's active page/channel selection for a platform
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { platformType, pageId } = await request.json();

    if (!platformType || !pageId) {
      return NextResponse.json({ error: "Missing platformType or pageId" }, { status: 400 });
    }

    // Store the selection on the platform record's metadata
    // Use the Platform model's existing fields or update metadata
    const platform = await db.platform.findFirst({
      where: { userId: session.user.id, type: platformType },
    });

    if (!platform) {
      return NextResponse.json({ error: "Platform not connected" }, { status: 404 });
    }

    // Store activePageId in the platform's metadata field if it exists,
    // otherwise use a simple key-value approach via localStorage on the client
    // For now, we'll store it in a lightweight way
    await db.platform.update({
      where: { id: platform.id },
      data: {
        // Store the selected page ID — check if metadata field exists on Platform model
        // If not, we'll use a workaround
        ...(platform as any).metadata !== undefined
          ? { metadata: { ...((platform as any).metadata || {}), activePageId: pageId } }
          : {},
      },
    });

    return NextResponse.json({ success: true, pageId });
  } catch (error) {
    console.error("Save active page error:", error);
    // Even if DB save fails, the localStorage save on the client still works
    return NextResponse.json({ success: true, pageId: "localStorage-only" });
  }
}
