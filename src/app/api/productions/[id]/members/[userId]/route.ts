import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { productionMembers, castProfiles } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "@/server/auth/rbac";
import { apiError, validationError, notFound, forbidden } from "@/server/api-error";
import { deleteHeadshot } from "@/server/storage";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const { id, userId } = await params;
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  // Only Director can promote/demote
  const { error: roleError } = await requireRole(user!.id, id, ["director"]);
  if (roleError) return roleError;

  // Can't modify yourself
  if (userId === user!.id) {
    return forbidden("You cannot modify your own role");
  }

  let body: { role?: string };
  try {
    body = await request.json();
  } catch {
    return apiError(400, "VALIDATION_ERROR", "Invalid JSON body");
  }

  if (!body.role || !["staff", "cast"].includes(body.role)) {
    return validationError([{ field: "role", message: "Role must be 'staff' or 'cast'" }]);
  }

  const [updated] = await db
    .update(productionMembers)
    .set({ role: body.role })
    .where(
      and(
        eq(productionMembers.productionId, id),
        eq(productionMembers.userId, userId)
      )
    )
    .returning();

  if (!updated) return notFound("Member not found");

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const { id, userId } = await params;
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  // Only Director can remove members
  const { error: roleError } = await requireRole(user!.id, id, ["director"]);
  if (roleError) return roleError;

  // Can't remove yourself
  if (userId === user!.id) {
    return forbidden("You cannot remove yourself from the production");
  }

  // Delete headshot from storage if exists
  const [profile] = await db
    .select({ headshotUrl: castProfiles.headshotUrl })
    .from(castProfiles)
    .where(and(eq(castProfiles.productionId, id), eq(castProfiles.userId, userId)))
    .limit(1);

  if (profile?.headshotUrl) {
    await deleteHeadshot(profile.headshotUrl);
  }

  // Remove member (cascades to cast_profiles, cast_conflicts, etc. via FK)
  const deleted = await db
    .delete(productionMembers)
    .where(
      and(
        eq(productionMembers.productionId, id),
        eq(productionMembers.userId, userId)
      )
    )
    .returning();

  if (deleted.length === 0) return notFound("Member not found");

  return NextResponse.json({ success: true });
}
