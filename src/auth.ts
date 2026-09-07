import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          include: { business: true },
        });
        if (!user) return null;

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          const attempts = user.failedLoginAttempts + 1;
          await prisma.user.update({
            where: { id: user.id },
            data:
              attempts >= MAX_FAILED_ATTEMPTS
                ? {
                    failedLoginAttempts: 0,
                    lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000),
                  }
                : { failedLoginAttempts: attempts },
          });
          return null;
        }

        if (user.failedLoginAttempts > 0 || user.lockedUntil) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockedUntil: null },
          });
        }

        if (user.business?.deletedAt) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          platformRole: user.platformRole,
          businessId: user.businessId,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id as string;
        token.platformRole = (user as unknown as { platformRole: string }).platformRole;
        token.businessId = (user as unknown as { businessId: string | null }).businessId;
      }
      // Keep businessId fresh (it can be set after signup completes onboarding)
      if (token.id && !user) {
        const dbUser = await prisma.user.findUnique({ where: { id: token.id as string } });
        if (dbUser) {
          token.businessId = dbUser.businessId;
          token.platformRole = dbUser.platformRole;
        }
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.platformRole = token.platformRole as string;
        session.user.businessId = (token.businessId as string | null) ?? null;
      }
      return session;
    },
  },
});
