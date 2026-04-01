import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isValidPlatform, PLATFORMS } from "@/lib/social/platforms";

// POST /api/social/disconnect/[platform] — Disconnects a platform
export async function POST(
  request: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { platform } = await params;

    if (!isValidPlatform(platform)) {
      return NextResponse.json(
        { error: `Invalid platform: ${platform}` },
        { status: 400 },
      );
    }

    const dbType = PLATFORMS[platform].dbType;

    // Delete or mark as disconnected
    await db.platform.updateMany({
      where: {
        userId: session.user.id,
        type: dbType,
      },
      data: {
        connected: false,
        accessToken: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Social disconnect error:", error);
    return NextResponse.json(
      { error: "Failed to disconnect platform" },
      { status: 500 },
    );
  }
}
