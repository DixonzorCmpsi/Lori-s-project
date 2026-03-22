import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "@/server/auth/rbac";
import { hashPassword, verifyPassword, validatePasswordStrength } from "@/server/auth/password";
import { apiError, validationError } from "@/server/api-error";

export async function POST(request: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return apiError(400, "VALIDATION_ERROR", "Invalid JSON body");
  }

  if (!body.currentPassword || !body.newPassword) {
    return validationError([{ field: "password", message: "Current and new passwords are required" }]);
  }

  const [dbUser] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user!.id))
    .limit(1);

  if (!dbUser?.passwordHash) {
    return apiError(400, "VALIDATION_ERROR", "No password set. Use Google account or set a password via reset.");
  }

  const valid = await verifyPassword(body.currentPassword, dbUser.passwordHash);
  if (!valid) {
    return validationError([{ field: "currentPassword", message: "Current password is incorrect" }]);
  }

  const strengthError = validatePasswordStrength(body.newPassword);
  if (strengthError) {
    return validationError([{ field: "newPassword", message: strengthError }]);
  }

  const newHash = await hashPassword(body.newPassword);

  // Update password + increment token_version (invalidates other sessions)
  await db.update(users).set({
    passwordHash: newHash,
    tokenVersion: sql`${users.tokenVersion} + 1`,
  }).where(eq(users.id, user!.id));

  return NextResponse.json({ message: "Password changed successfully" });
}
