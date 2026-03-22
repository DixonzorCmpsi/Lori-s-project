import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { productionMembers } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { unauthorized, forbidden } from "@/server/api-error";

type Role = "director" | "staff" | "cast";

/**
 * Get the authenticated user from the session.
 * Returns null if not authenticated.
 */
export async function getAuthUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user;
}

/**
 * Require authentication. Returns the user or a 401 response.
 */
export async function requireAuth() {
  const user = await getAuthUser();
  if (!user) return { user: null, error: unauthorized("Authentication required") };
  return { user, error: null };
}

/**
 * Get the user's membership in a production.
 * Returns null if not a member.
 */
export async function getMembership(userId: string, productionId: string) {
  const [member] = await db
    .select()
    .from(productionMembers)
    .where(
      and(
        eq(productionMembers.userId, userId),
        eq(productionMembers.productionId, productionId)
      )
    )
    .limit(1);
  return member ?? null;
}

/**
 * Require the user to be a member of a production.
 * Returns membership or a 403 response.
 */
export async function requireMember(userId: string, productionId: string) {
  const member = await getMembership(userId, productionId);
  if (!member) return { member: null, error: forbidden("You are not a member of this production") };
  return { member, error: null };
}

/**
 * Require the user to have one of the specified roles in a production.
 * Returns membership or a 403 response.
 */
export async function requireRole(userId: string, productionId: string, allowedRoles: Role[]) {
  const { member, error } = await requireMember(userId, productionId);
  if (error) return { member: null, error };
  if (!allowedRoles.includes(member!.role as Role)) {
    return { member: null, error: forbidden() };
  }
  return { member, error: null };
}
