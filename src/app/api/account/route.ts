import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { users, castProfiles } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/server/auth/rbac";
import { apiError, validationError } from "@/server/api-error";
import { deleteHeadshot } from "@/server/storage";

// GET: Current user profile
export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  const [profile] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
      ageRange: users.ageRange,
      emailVerified: users.emailVerified,
      googleId: users.googleId,
      hasPassword: users.passwordHash,
    })
    .from(users)
    .where(eq(users.id, user!.id))
    .limit(1);

  if (!profile) return apiError(404, "NOT_FOUND", "User not found");

  return NextResponse.json({
    ...profile,
    hasPassword: !!profile.hasPassword,
    hasGoogle: !!profile.googleId,
    googleId: undefined,
  });
}

// PATCH: Update name
export async function PATCH(request: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return apiError(400, "VALIDATION_ERROR", "Invalid JSON body");
  }

  if (!body.name || body.name.length === 0 || body.name.length > 200) {
    return validationError([{ field: "name", message: "Name must be 1-200 characters" }]);
  }

  const [updated] = await db
    .update(users)
    .set({ name: body.name })
    .where(eq(users.id, user!.id))
    .returning({ id: users.id, name: users.name });

  return NextResponse.json(updated);
}

// DELETE: Delete account (cascade deletes all data)
export async function DELETE() {
  const { user, error } = await requireAuth();
  if (error) return error;

  // Delete headshot files from all productions
  const profiles = await db
    .select({ headshotUrl: castProfiles.headshotUrl })
    .from(castProfiles)
    .where(eq(castProfiles.userId, user!.id));

  for (const p of profiles) {
    if (p.headshotUrl) await deleteHeadshot(p.headshotUrl);
  }

  // CASCADE handles all related rows
  await db.delete(users).where(eq(users.id, user!.id));

  return NextResponse.json({ success: true });
}
