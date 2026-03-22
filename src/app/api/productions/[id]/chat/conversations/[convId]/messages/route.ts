import { rejectIfArchived } from "@/server/auth/archive-guard";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { messages, conversationParticipants, conversations, productionMembers, chatRateLimits, users } from "@/server/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth, requireMember } from "@/server/auth/rbac";
import { messageSchema } from "@/shared/validators";
import { apiError, validationError, forbidden, rateLimited } from "@/server/api-error";

// GET: Paginated message history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; convId: string }> }
) {
  const { id, convId } = await params;
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const { error: memberError } = await requireMember(user!.id, id);
  if (memberError) return memberError;

  // Verify user is participant in this conversation
  const [participant] = await db
    .select()
    .from(conversationParticipants)
    .where(and(eq(conversationParticipants.conversationId, convId), eq(conversationParticipants.userId, user!.id)))
    .limit(1);

  if (!participant) return forbidden("You are not a participant in this conversation");

  const page = parseInt(request.nextUrl.searchParams.get("page") || "1");
  const limit = 50;
  const offset = (page - 1) * limit;

  const msgs = await db
    .select({
      id: messages.id,
      body: messages.body,
      senderId: messages.senderId,
      senderName: users.name,
      isRead: messages.isRead,
      isDeleted: messages.isDeleted,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(users, eq(messages.senderId, users.id))
    .where(eq(messages.conversationId, convId))
    .orderBy(desc(messages.createdAt))
    .limit(limit)
    .offset(offset);

  // Return in chronological order (oldest first for display)
  return NextResponse.json(msgs.reverse());
}

// POST: Send a message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; convId: string }> }
) {
  const { id, convId } = await params;
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const { member, error: memberError } = await requireMember(user!.id, id);
  if (memberError) return memberError;

  // Verify conversation belongs to production and user is participant
  const [convo] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, convId), eq(conversations.productionId, id)))
    .limit(1);

  if (!convo) return apiError(404, "NOT_FOUND", "Conversation not found");

  const [participant] = await db
    .select()
    .from(conversationParticipants)
    .where(and(eq(conversationParticipants.conversationId, convId), eq(conversationParticipants.userId, user!.id)))
    .limit(1);

  if (!participant) return forbidden("You are not a participant in this conversation");

  // Role boundary check: verify the OTHER participant isn't cast if sender is cast
  if (member!.role === "cast") {
    const [otherParticipant] = await db
      .select({ userId: conversationParticipants.userId })
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, convId),
          sql`${conversationParticipants.userId} != ${user!.id}`
        )
      )
      .limit(1);

    if (otherParticipant) {
      const [otherMember] = await db
        .select({ role: productionMembers.role })
        .from(productionMembers)
        .where(and(eq(productionMembers.productionId, id), eq(productionMembers.userId, otherParticipant.userId)))
        .limit(1);

      if (otherMember?.role === "cast") {
        return forbidden("Cast members cannot message other cast members");
      }
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "VALIDATION_ERROR", "Invalid JSON body");
  }

  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues.map((i) => ({
      field: String(i.path[0] ?? "unknown"),
      message: i.message,
    })));
  }

  // Rate limit: 30 messages per minute per user (database-backed for production)
  const windowStart = new Date(Math.floor(Date.now() / 60000) * 60000); // Current minute
  try {
    const [rateRow] = await db
      .insert(chatRateLimits)
      .values({ userId: user!.id, windowStart, messageCount: 1 })
      .onConflictDoUpdate({
        target: [chatRateLimits.userId, chatRateLimits.windowStart],
        set: { messageCount: sql`${chatRateLimits.messageCount} + 1` },
      })
      .returning();

    if (rateRow.messageCount > 30) {
      return rateLimited("Message rate limit exceeded. Max 30 per minute.");
    }
  } catch {
    // Rate limit check failed — allow the message (fail open for availability)
  }

  const [msg] = await db.insert(messages).values({
    conversationId: convId,
    senderId: user!.id,
    body: parsed.data.body,
  }).returning();

  return NextResponse.json(msg, { status: 201 });
}
