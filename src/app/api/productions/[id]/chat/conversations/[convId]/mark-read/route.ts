import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { messages, conversationParticipants } from "@/server/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { requireAuth } from "@/server/auth/rbac";
import { forbidden } from "@/server/api-error";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; convId: string }> }
) {
  const { convId } = await params;
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  // Verify participant
  const [participant] = await db
    .select()
    .from(conversationParticipants)
    .where(and(eq(conversationParticipants.conversationId, convId), eq(conversationParticipants.userId, user!.id)))
    .limit(1);

  if (!participant) return forbidden("You are not a participant in this conversation");

  // Mark all messages from other sender as read
  await db
    .update(messages)
    .set({ isRead: true })
    .where(
      and(
        eq(messages.conversationId, convId),
        ne(messages.senderId, user!.id),
        eq(messages.isRead, false)
      )
    );

  return NextResponse.json({ success: true });
}
