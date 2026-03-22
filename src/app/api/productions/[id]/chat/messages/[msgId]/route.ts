import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { messages, conversations, productionMembers } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireMember } from "@/server/auth/rbac";
import { forbidden, notFound } from "@/server/api-error";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; msgId: string }> }
) {
  const { id, msgId } = await params;
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const { member, error: memberError } = await requireMember(user!.id, id);
  if (memberError) return memberError;

  const [msg] = await db
    .select()
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(and(eq(messages.id, msgId), eq(conversations.productionId, id)))
    .limit(1);

  if (!msg) return notFound("Message not found");

  const isDirector = member!.role === "director";
  const isOwnMessage = msg.messages.senderId === user!.id;

  if (isDirector) {
    // Director can delete any message anytime
    await db
      .update(messages)
      .set({ body: "[Message removed by director]", isDeleted: true })
      .where(eq(messages.id, msgId));
    return NextResponse.json({ success: true });
  }

  if (isOwnMessage) {
    // Self-delete within 5 minutes
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (msg.messages.createdAt && msg.messages.createdAt < fiveMinAgo) {
      return forbidden("Messages can only be deleted within 5 minutes of sending");
    }
    await db
      .update(messages)
      .set({ body: "[Message deleted]", isDeleted: true })
      .where(eq(messages.id, msgId));
    return NextResponse.json({ success: true });
  }

  // Staff tries to delete someone else's message
  return forbidden("Only the director can delete other users' messages");
}
