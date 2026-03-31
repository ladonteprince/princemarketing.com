"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

// WHY: Wraps the app in NextAuth SessionProvider so useSession() works everywhere.
export function AuthProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
