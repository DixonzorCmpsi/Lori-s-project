import { redirect, notFound } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { productionMembers, users, castProfiles, conflictSubmissions, inviteTokens } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { RosterClient } from "./roster-client";

export default async function RosterPage({
  params,
}: {
  params: Promise<{ productionId: string }>;
}) {
  const { productionId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Verify Director or Staff
  const [member] = await db
    .select({ role: productionMembers.role })
    .from(productionMembers)
    .where(and(eq(productionMembers.productionId, productionId), eq(productionMembers.userId, session.user.id)))
    .limit(1);

  if (!member || member.role === "cast") notFound();

  // Get all members with profile + conflict status
  const members = await db
    .select({
      userId: productionMembers.userId,
      role: productionMembers.role,
      joinedAt: productionMembers.joinedAt,
      name: users.name,
      email: users.email,
    })
    .from(productionMembers)
    .innerJoin(users, eq(productionMembers.userId, users.id))
    .where(eq(productionMembers.productionId, productionId));

  // Get conflict submission status per user
  const submissions = await db
    .select({ userId: conflictSubmissions.userId })
    .from(conflictSubmissions)
    .where(eq(conflictSubmissions.productionId, productionId));

  const submittedSet = new Set(submissions.map((s) => s.userId));

  // Get invite token
  const [invite] = await db
    .select()
    .from(inviteTokens)
    .where(eq(inviteTokens.productionId, productionId))
    .limit(1);

  const memberData = members.map((m) => ({
    userId: m.userId,
    name: m.name,
    email: m.email,
    role: m.role,
    joinedAt: m.joinedAt?.toISOString() ?? "",
    conflictsSubmitted: submittedSet.has(m.userId),
  }));

  return (
    <RosterClient
      productionId={productionId}
      members={memberData}
      currentUserRole={member.role}
      currentUserId={session.user.id}
      invite={invite ? {
        token: invite.token,
        expiresAt: invite.expiresAt.toISOString(),
        useCount: invite.useCount,
        maxUses: invite.maxUses,
      } : null}
    />
  );
}
