import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// POST — Save the user's active page/channel selection for a platform
// Persists to localStorage on the client side (this endpoint is a confirmation)
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

    // For now, the primary persistence is localStorage on the client.
    // This endpoint acknowledges the save. Future: persist to DB when Platform model
    // gets a metadata/preferences field.
    return NextResponse.json({ success: true, platformType, pageId });
  } catch (error) {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
