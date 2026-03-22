import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { rehearsalDates } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireMember } from "@/server/auth/rbac";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const { member, error: memberError } = await requireMember(user!.id, id);
  if (memberError) return memberError;

  const isCast = member!.role === "cast";

  const dates = await db
    .select()
    .from(rehearsalDates)
    .where(
      isCast
        ? and(eq(rehearsalDates.productionId, id), eq(rehearsalDates.isDeleted, false))
        : eq(rehearsalDates.productionId, id)
    )
    .orderBy(rehearsalDates.date);

  return NextResponse.json(dates);
}
