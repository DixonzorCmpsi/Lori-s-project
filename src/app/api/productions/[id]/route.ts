import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { productions, castProfiles, inviteTokens } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireMember, requireRole } from "@/server/auth/rbac";
import { apiError, validationError, notFound } from "@/server/api-error";
import { deleteHeadshot } from "@/server/storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const { error: memberError } = await requireMember(user!.id, id);
  if (memberError) return memberError;

  const [production] = await db
    .select()
    .from(productions)
    .where(eq(productions.id, id))
    .limit(1);

  if (!production) return notFound("Production not found");

  return NextResponse.json(production);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const { error: roleError } = await requireRole(user!.id, id, ["director", "staff"]);
  if (roleError) return roleError;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "VALIDATION_ERROR", "Invalid JSON body");
  }

  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.length === 0 || body.name.length > 200) {
      return validationError([{ field: "name", message: "Name must be 1-200 characters" }]);
    }
    updates.name = body.name;
  }

  if (body.isArchived !== undefined) {
    if (body.isArchived) {
      updates.isArchived = true;
      updates.archivedAt = new Date();
      // Deactivate invite link on archive
      await db.delete(inviteTokens).where(eq(inviteTokens.productionId, id));
    } else {
      // Unarchive: only within 90 days
      const [prod] = await db.select({ archivedAt: productions.archivedAt })
        .from(productions).where(eq(productions.id, id)).limit(1);
      if (prod?.archivedAt) {
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        if (new Date(prod.archivedAt) < ninetyDaysAgo) {
          return apiError(400, "VALIDATION_ERROR", "PII deleted — cannot be restored");
        }
      }
      updates.isArchived = false;
      updates.archivedAt = null;
    }
  }

  if (Object.keys(updates).length === 0) {
    return apiError(400, "VALIDATION_ERROR", "No valid fields to update");
  }

  const [updated] = await db
    .update(productions)
    .set(updates)
    .where(eq(productions.id, id))
    .returning();

  if (!updated) return notFound("Production not found");

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  // Director only
  const { error: roleError } = await requireRole(user!.id, id, ["director"]);
  if (roleError) return roleError;

  // Delete headshot files from storage before cascade-deleting DB rows
  const profiles = await db
    .select({ headshotUrl: castProfiles.headshotUrl })
    .from(castProfiles)
    .where(eq(castProfiles.productionId, id));

  for (const p of profiles) {
    if (p.headshotUrl) await deleteHeadshot(p.headshotUrl);
  }

  // CASCADE deletes handle all related rows
  await db.delete(productions).where(eq(productions.id, id));

  return NextResponse.json({ success: true });
}
