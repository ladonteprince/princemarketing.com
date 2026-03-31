import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

// WHY: NextAuth v5 config with Credentials provider.
// Uses Prisma to look up users by email, bcrypt for password verification.

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    newUser: "/dashboard",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await db.user.findUnique({ where: { email } });

        if (!user) {
          return null;
        }

        // Compare with bcrypt. Fallback: if passwordHash is not a bcrypt hash
        // (legacy plain-text from initial build), do direct comparison.
        let passwordValid = false;
        if (user.passwordHash.startsWith("$2")) {
          passwordValid = await bcrypt.compare(password, user.passwordHash);
        } else {
          // Legacy plain-text passwords from initial build
          passwordValid = user.passwordHash === password;
        }

        if (!passwordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          tier: user.tier,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.tier = (user as { tier?: string }).tier ?? "STARTER";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { tier?: string }).tier = token.tier as string;
      }
      return session;
    },
  },
});
