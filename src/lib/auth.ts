import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
    newUser: "/dashboard",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
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

        // Compare with bcrypt only — no plain-text fallback
        const passwordValid = await bcrypt.compare(password, user.passwordHash);

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
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const existing = await db.user.findUnique({ where: { email: user.email } });
        if (!existing) {
          await db.user.create({
            data: {
              email: user.email,
              name: user.name ?? "",
              passwordHash: "",
              tier: "STARTER",
            },
          });
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user && account?.provider === "google" && user.email) {
        const dbUser = await db.user.findUnique({ where: { email: user.email } });
        if (dbUser) {
          token.id = dbUser.id;
          token.tier = dbUser.tier;
        }
      } else if (user) {
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
