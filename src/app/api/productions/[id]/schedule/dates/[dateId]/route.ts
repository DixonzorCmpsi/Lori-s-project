import { rejectIfArchived } from "@/server/auth/archive-guard";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { rehearsalDates, bulletinPosts } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "@/server/auth/rbac";
import { apiError, validationError, notFound } from "@/server/api-error";

/** Verify dateId belongs to productionId — prevents IDOR (SPEC-003 Section 8.1) */
async function findDate(dateId: string, productionId: string) {
  const [row] = await db
    .select()
    .from(rehearsalDates)
    .where(and(eq(rehearsalDates.id, dateId), eq(rehearsalDates.productionId, productionId)))
    .limit(1);
  return row ?? null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dateId: string }> }
) {
  const { id, dateId } = await params;
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const { error: roleError } = await requireRole(user!.id, id, ["director", "staff"]);
  if (roleError) return roleError;

  const existing = await findDate(dateId, id);
  if (!existing) return notFound("Rehearsal date not found");

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "VALIDATION_ERROR", "Invalid JSON body");
  }

  // Validate note length
  if (body.note !== undefined && typeof body.note === "string" && body.note.length > 1000) {
    return validationError([{ field: "note", message: "Note must be 1,000 characters or fewer" }]);
  }

  const updates: Record<string, unknown> = {};
  if (body.startTime !== undefined) updates.startTime = body.startTime;
  if (body.endTime !== undefined) updates.endTime = body.endTime;
  if (body.note !== undefined) updates.note = body.note;
  if (body.isCancelled !== undefined) updates.isCancelled = Boolean(body.isCancelled);

  if (Object.keys(updates).length === 0) {
    return apiError(400, "VALIDATION_ERROR", "No valid fields to update");
  }

  const [updated] = await db
    .update(rehearsalDates)
    .set(updates)
    .where(and(eq(rehearsalDates.id, dateId), eq(rehearsalDates.productionId, id)))
    .returning();

  // System bulletin posts for schedule changes (SPEC-006 Section 5.1)
  if (body.isCancelled) {
    await db.insert(bulletinPosts).values({
      productionId: id,
      authorId: user!.id,
      title: "Schedule Updated",
      body: `Rehearsal cancelled: ${updated.date}`,
    });
  } else if (body.startTime !== undefined || body.endTime !== undefined) {
    await db.insert(bulletinPosts).values({
      productionId: id,
      authorId: user!.id,
      title: "Schedule Updated",
      body: `Rehearsal time changed: ${updated.date} now ${updated.startTime}-${updated.endTime}`,
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dateId: string }> }
) {
  const { id, dateId } = await params;
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const { error: roleError } = await requireRole(user!.id, id, ["director", "staff"]);
  if (roleError) return roleError;

  const existing = await findDate(dateId, id);
  if (!existing) return notFound("Rehearsal date not found");

  const permanent = request.nextUrl.searchParams.get("permanent") === "true";

  if (permanent) {
    await db.delete(rehearsalDates).where(and(eq(rehearsalDates.id, dateId), eq(rehearsalDates.productionId, id)));
    await db.insert(bulletinPosts).values({
      productionId: id,
      authorId: user!.id,
      title: "Schedule Updated",
      body: `Rehearsal permanently deleted: ${existing.date}`,
    });
  } else {
    await db.update(rehearsalDates).set({
      isDeleted: true,
      deletedAt: new Date(),
    }).where(and(eq(rehearsalDates.id, dateId), eq(rehearsalDates.productionId, id)));
    await db.insert(bulletinPosts).values({
      productionId: id,
      authorId: user!.id,
      title: "Schedule Updated",
      body: `Rehearsal removed: ${existing.date}`,
    });
  }

  return NextResponse.json({ success: true });
}
