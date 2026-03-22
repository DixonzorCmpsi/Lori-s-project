import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { inviteTokens, productionMembers } from "@/server/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { requireAuth } from "@/server/auth/rbac";
import { apiError } from "@/server/api-error";

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return apiError(400, "VALIDATION_ERROR", "Invalid JSON body");
  }

  const rawToken = body.token;
  if (!rawToken) {
    return apiError(400, "VALIDATION_ERROR", "Invite token is required");
  }

  // Look up valid token
  const [invite] = await db
    .select()
    .from(inviteTokens)
    .where(
      and(
        eq(inviteTokens.token, rawToken),
        gt(inviteTokens.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!invite) {
    return apiError(400, "UNAUTHORIZED", "This invite link has expired. Ask your director for a new link.");
  }

  // Check max uses
  if (invite.useCount >= invite.maxUses) {
    return apiError(400, "UNAUTHORIZED", "This invite link is no longer available.");
  }

  // Check if already a member
  const [existing] = await db
    .select({ id: productionMembers.id })
    .from(productionMembers)
    .where(
      and(
        eq(productionMembers.productionId, invite.productionId),
        eq(productionMembers.userId, user!.id)
      )
    )
    .limit(1);

  if (existing) {
    // Already a member — just return the production ID
    return NextResponse.json({ productionId: invite.productionId, alreadyMember: true });
  }

  // Join as cast + increment use count
  await db.transaction(async (tx) => {
    await tx.insert(productionMembers).values({
      productionId: invite.productionId,
      userId: user!.id,
      role: "cast",
    });
    await tx.update(inviteTokens).set({
      useCount: invite.useCount + 1,
    }).where(eq(inviteTokens.id, invite.id));
  });

  return NextResponse.json({ productionId: invite.productionId, alreadyMember: false }, { status: 201 });
}
