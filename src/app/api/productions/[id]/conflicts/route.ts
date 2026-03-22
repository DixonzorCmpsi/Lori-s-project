import { rejectIfArchived } from "@/server/auth/archive-guard";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { castConflicts, conflictSubmissions, rehearsalDates } from "@/server/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, requireMember } from "@/server/auth/rbac";
import { conflictSubmissionSchema } from "@/shared/validators";
import { apiError, validationError, conflict, forbidden } from "@/server/api-error";

// GET: Fetch user's own conflicts (cast) or all conflicts (director/staff)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const { member, error: memberError } = await requireMember(user!.id, id);
  if (memberError) return memberError;

  if (member!.role === "cast") {
    // Cast sees only their own conflicts
    const conflicts = await db
      .select()
      .from(castConflicts)
      .where(and(eq(castConflicts.productionId, id), eq(castConflicts.userId, user!.id)));

    const [submission] = await db
      .select()
      .from(conflictSubmissions)
      .where(and(eq(conflictSubmissions.productionId, id), eq(conflictSubmissions.userId, user!.id)))
      .limit(1);

    return NextResponse.json({ conflicts, submitted: !!submission });
  }

  // Director/Staff see all conflicts
  const conflicts = await db
    .select()
    .from(castConflicts)
    .where(eq(castConflicts.productionId, id));

  return NextResponse.json({ conflicts, submitted: null });
}

// POST: Submit conflicts (cast only, one-time, all-or-nothing transaction)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const { member, error: memberError } = await requireMember(user!.id, id);
  if (memberError) return memberError;

  // Only cast can submit conflicts
  if (member!.role !== "cast") {
    return forbidden("Only cast members can submit conflicts");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "VALIDATION_ERROR", "Invalid JSON body");
  }

  const parsed = conflictSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues.map((i) => ({
      field: String(i.path.join(".")),
      message: i.message,
    })));
  }

  const { dates } = parsed.data;

  // Validate all rehearsalDateIds belong to this production and are not deleted
  if (dates.length > 0) {
    const dateIds = dates.map((d) => d.rehearsalDateId);
    const validDates = await db
      .select({ id: rehearsalDates.id })
      .from(rehearsalDates)
      .where(
        and(
          eq(rehearsalDates.productionId, id),
          eq(rehearsalDates.isDeleted, false),
          inArray(rehearsalDates.id, dateIds)
        )
      );

    const validIds = new Set(validDates.map((d) => d.id));
    const invalidIds = dateIds.filter((did) => !validIds.has(did));

    if (invalidIds.length > 0) {
      return apiError(400, "VALIDATION_ERROR", "Invalid rehearsal date IDs", undefined);
    }
  }

  // All-or-nothing transaction (SPEC-004 Section 4.3)
  // conflict_submissions UNIQUE(production_id, user_id) is the authoritative guard
  try {
    await db.transaction(async (tx) => {
      // This INSERT is the authoritative guard — unique constraint catches double submission
      await tx.insert(conflictSubmissions).values({
        productionId: id,
        userId: user!.id,
      });

      // Insert individual conflicts (empty submission = zero conflicts is valid)
      if (dates.length > 0) {
        await tx.insert(castConflicts).values(
          dates.map((d) => ({
            productionId: id,
            userId: user!.id,
            rehearsalDateId: d.rehearsalDateId,
            reason: d.reason || null,
          }))
        );
      }
    });
  } catch (err: unknown) {
    // Unique constraint violation = already submitted
    const message = err instanceof Error ? err.message : "";
    if (message.includes("unique") || message.includes("duplicate") || message.includes("conflict_submissions_unique")) {
      return conflict("Conflicts already submitted");
    }
    throw err;
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
