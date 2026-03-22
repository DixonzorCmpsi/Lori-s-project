import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword } from "./password";
import { sendLockoutEmail } from "@/server/email";

// No DrizzleAdapter — we use JWT strategy and manage users manually in signIn callback.
// See SPEC-002 Section 2.1 and Section 4 for rationale.

export const { handlers, signIn, signOut, auth } = NextAuth({
  // NO adapter. User CRUD happens in signIn callback via Drizzle ORM.
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: { params: { scope: "openid email profile" } },
    }),
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = credentials?.email as string;
        const password = credentials?.password as string;
        if (!email || !password) return null;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email.toLowerCase()))
          .limit(1);

        if (!user) return null;

        // Account lockout check
        if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
          throw new Error("ACCOUNT_LOCKED");
        }

        if (!user.passwordHash) return null;

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) {
          const newAttempts = (user.failedLoginAttempts ?? 0) + 1;
          if (newAttempts >= 10) {
            await db.update(users).set({
              failedLoginAttempts: newAttempts,
              lockedUntil: new Date(Date.now() + 30 * 60 * 1000),
            }).where(eq(users.id, user.id));
            sendLockoutEmail(user.email);
            throw new Error("ACCOUNT_LOCKED");
          } else {
            await db.update(users).set({
              failedLoginAttempts: newAttempts,
            }).where(eq(users.id, user.id));
          }
          return null;
        }

        // Reset failed attempts on success
        if (user.failedLoginAttempts && user.failedLoginAttempts > 0) {
          await db.update(users).set({
            failedLoginAttempts: 0,
            lockedUntil: null,
          }).where(eq(users.id, user.id));
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl,
          tokenVersion: user.tokenVersion,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 7 * 24 * 60 * 60, // 7-day rolling refresh
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const email = user.email?.toLowerCase();
        if (!email) return false;

        const [existing] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (existing) {
          // Safe account linking: only if existing is email-verified
          if (!existing.googleId && existing.emailVerified) {
            await db.update(users).set({
              googleId: account.providerAccountId,
              emailVerified: true,
            }).where(eq(users.id, existing.id));
          }
          return true;
        }

        // Create new user — age_range NULL signals post-OAuth age gate needed
        await db.insert(users).values({
          email,
          name: user.name ?? email,
          googleId: account.providerAccountId,
          emailVerified: true,
          avatarUrl: user.image,
          // age_range intentionally NULL — user must complete /complete-profile
        });
        return true;
      }
      return true;
    },

    async jwt({ token, user, trigger }) {
      // On initial sign-in, store user ID and tokenVersion in JWT
      if (user) {
        token.id = user.id;
        token.tokenVersion = (user as Record<string, unknown>).tokenVersion ?? 0;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  trustHost: true,
});

/**
 * Validate that a JWT's tokenVersion matches the database.
 * Call this on security-critical operations (not every request).
 * Returns true if valid, false if the JWT is stale (user must re-auth).
 */
export async function validateTokenVersion(userId: string, jwtTokenVersion: number): Promise<boolean> {
  const [user] = await db
    .select({ tokenVersion: users.tokenVersion })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return false;
  return user.tokenVersion === jwtTokenVersion;
}
