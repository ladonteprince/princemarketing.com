// Server-side session helper
// WHY: Centralized auth check that returns the full user from DB, not just the JWT payload

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function getAuthenticatedUser() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      businessName: true,
      businessType: true,
      industry: true,
      tier: true,
      onboarded: true,
    },
  });

  return user;
}
