import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { productionMembers, users } from "@/server/db/schema";
import { eq, and, ne, inArray } from "drizzle-orm";
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

  // Cast sees only director + staff. Director/Staff see everyone.
  const roleFilter = isCast
    ? and(
        eq(productionMembers.productionId, id),
        ne(productionMembers.userId, user!.id),
        inArray(productionMembers.role, ["director", "staff"])
      )
    : and(
        eq(productionMembers.productionId, id),
        ne(productionMembers.userId, user!.id)
      );

  const contacts = await db
    .select({
      userId: productionMembers.userId,
      role: productionMembers.role,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(productionMembers)
    .innerJoin(users, eq(productionMembers.userId, users.id))
    .where(roleFilter);

  return NextResponse.json(contacts);
}
