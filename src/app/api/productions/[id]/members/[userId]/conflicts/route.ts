import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { castConflicts, conflictSubmissions, bulletinPosts, castProfiles } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "@/server/auth/rbac";
import { notFound } from "@/server/api-error";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const { id, userId } = await params;
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  // Only Director can reset conflicts
  const { error: roleError } = await requireRole(user!.id, id, ["director"]);
  if (roleError) return roleError;

  // Delete conflicts + submission in a single transaction
  await db.transaction(async (tx) => {
    await tx.delete(castConflicts).where(
      and(eq(castConflicts.productionId, id), eq(castConflicts.userId, userId))
    );
    await tx.delete(conflictSubmissions).where(
      and(eq(conflictSubmissions.productionId, id), eq(conflictSubmissions.userId, userId))
    );
  });

  // Get member name for bulletin post
  const [profile] = await db
    .select({ displayName: castProfiles.displayName })
    .from(castProfiles)
    .where(and(eq(castProfiles.productionId, id), eq(castProfiles.userId, userId)))
    .limit(1);

  // System bulletin post
  await db.insert(bulletinPosts).values({
    productionId: id,
    authorId: user!.id,
    title: "Conflicts Reset",
    body: `${profile?.displayName ?? "A cast member"}'s conflicts have been reset by the director. Please re-submit your conflicts.`,
  });

  return NextResponse.json({ success: true });
}
