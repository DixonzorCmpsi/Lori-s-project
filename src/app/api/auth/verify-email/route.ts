import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, emailVerificationTokens } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { hashToken } from "@/lib/auth/tokens";
import { apiError } from "@/lib/api-error";

export async function POST(request: NextRequest) {
  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return apiError(400, "VALIDATION_ERROR", "Invalid JSON body");
  }

  const rawToken = body.token;
  if (!rawToken) {
    return apiError(400, "VALIDATION_ERROR", "Token is required");
  }

  const tokenHash = hashToken(rawToken);

  const [tokenRecord] = await db
    .select()
    .from(emailVerificationTokens)
    .where(
      and(
        eq(emailVerificationTokens.tokenHash, tokenHash),
        gt(emailVerificationTokens.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!tokenRecord) {
    return apiError(400, "UNAUTHORIZED", "This verification link has expired. Request a new one.");
  }

  // Set email_verified, delete token (single-use)
  await db.update(users).set({ emailVerified: true }).where(eq(users.id, tokenRecord.userId));
  await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.id, tokenRecord.id));

  return NextResponse.json({ message: "Email verified successfully" }, { status: 200 });
}
