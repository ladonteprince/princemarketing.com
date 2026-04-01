import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/user/platforms — Returns connected platforms for the authenticated user
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const platforms = await db.platform.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        type: true,
        accountName: true,
        connected: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ platforms });
  } catch (error) {
    console.error("Platforms fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch platforms" },
      { status: 500 },
    );
  }
}
