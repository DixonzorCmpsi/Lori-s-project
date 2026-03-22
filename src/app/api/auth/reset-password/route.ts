import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { users, passwordResetTokens } from "@/server/db/schema";
import { eq, and, gt, sql } from "drizzle-orm";
import { resetPasswordSchema } from "@/shared/validators";
import { hashPassword, validatePasswordStrength } from "@/server/auth/password";
import { hashToken } from "@/server/auth/tokens";
import { apiError, validationError } from "@/server/api-error";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "VALIDATION_ERROR", "Invalid JSON body");
  }

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues.map((i) => ({
      field: String(i.path[0] ?? "unknown"),
      message: i.message,
    })));
  }

  const { token: rawToken, password } = parsed.data;

  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    return validationError([{ field: "password", message: passwordError }]);
  }

  const tokenHashValue = hashToken(rawToken);

  const [tokenRecord] = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHashValue),
        gt(passwordResetTokens.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!tokenRecord) {
    return apiError(400, "UNAUTHORIZED", "Reset link has expired. Request a new one.");
  }

  const newHash = await hashPassword(password);

  // Update password, delete token, increment token_version to invalidate all JWTs
  await db.update(users).set({
    passwordHash: newHash,
    tokenVersion: sql`${users.tokenVersion} + 1`,
  }).where(eq(users.id, tokenRecord.userId));

  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, tokenRecord.id));

  return NextResponse.json({ message: "Password reset successfully" }, { status: 200 });
}
