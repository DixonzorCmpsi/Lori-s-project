import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, emailVerificationTokens } from "@/lib/db/schema";
import { eq, and, gt, count } from "drizzle-orm";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { sendVerificationEmail } from "@/lib/email";
import { apiError, validationError } from "@/lib/api-error";
import { forgotPasswordSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "VALIDATION_ERROR", "Invalid JSON body");
  }

  const parsed = forgotPasswordSchema.safeParse(body); // reuse email-only schema
  if (!parsed.success) {
    return validationError(parsed.error.issues.map((i) => ({
      field: String(i.path[0] ?? "unknown"),
      message: i.message,
    })));
  }

  const normalizedEmail = parsed.data.email.toLowerCase();

  // Anti-enumeration: always return same response
  const successResponse = NextResponse.json(
    { message: "If that email exists and is unverified, a new link has been sent" },
    { status: 200 }
  );

  const [user] = await db
    .select({ id: users.id, emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (!user || user.emailVerified) return successResponse;

  // Rate limit: max 3 verification emails per hour per email
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [recentCount] = await db
    .select({ count: count() })
    .from(emailVerificationTokens)
    .where(
      and(
        eq(emailVerificationTokens.userId, user.id),
        gt(emailVerificationTokens.createdAt, oneHourAgo)
      )
    );

  if (recentCount && recentCount.count >= 3) return successResponse;

  const rawToken = generateToken();
  const tokenHashValue = hashToken(rawToken);

  await db.insert(emailVerificationTokens).values({
    userId: user.id,
    tokenHash: tokenHashValue,
  });

  sendVerificationEmail(normalizedEmail, rawToken);

  return successResponse;
}
