import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, passwordResetTokens } from "@/lib/db/schema";
import { eq, and, gt, count } from "drizzle-orm";
import { forgotPasswordSchema } from "@/lib/validators";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { sendPasswordResetEmail } from "@/lib/email";
import { apiError, validationError } from "@/lib/api-error";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "VALIDATION_ERROR", "Invalid JSON body");
  }

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues.map((i) => ({
      field: String(i.path[0] ?? "unknown"),
      message: i.message,
    })));
  }

  const normalizedEmail = parsed.data.email.toLowerCase();

  // Anti-enumeration: always return same response
  const successResponse = NextResponse.json(
    { message: "If that email exists, a reset link has been sent" },
    { status: 200 }
  );

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (!user) return successResponse;

  // Rate limit: max 3 reset requests per email per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [recentCount] = await db
    .select({ count: count() })
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.userId, user.id),
        gt(passwordResetTokens.createdAt, oneHourAgo)
      )
    );

  if (recentCount && recentCount.count >= 3) return successResponse;

  // Generate token
  const rawToken = generateToken();
  const tokenHashValue = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash: tokenHashValue,
    expiresAt,
  });

  sendPasswordResetEmail(normalizedEmail, rawToken);

  return successResponse;
}
