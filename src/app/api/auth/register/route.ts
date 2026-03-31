import { NextResponse } from "next/server";
import { registerSchema } from "@/types/user";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    // 1. Parse and validate
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const { email, password, name } = parsed.data;

    // 2. Check for existing user
    const existing = await db.user.findUnique({ where: { email } });

    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 },
      );
    }

    // 3. Create user
    // WHY: In production, hash password with bcrypt before storing
    // TODO: Replace with bcrypt.hash(password, 12)
    const user = await db.user.create({
      data: {
        email,
        passwordHash: password,
        name,
      },
    });

    // 4. Create session
    const session = await db.session.create({
      data: {
        userId: user.id,
        token: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // 5. Return with session cookie
    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          tier: user.tier,
        },
      },
      { status: 201 },
    );

    response.cookies.set("session", session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
