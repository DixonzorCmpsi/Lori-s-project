import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { conversations, conversationParticipants, messages, users, productionMembers } from "@/server/db/schema";
import { eq, and, desc, inArray, ne, sql } from "drizzle-orm";
import { requireAuth, requireMember } from "@/server/auth/rbac";
import { apiError, forbidden } from "@/server/api-error";

// GET: List conversations sorted by most recent message
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const { error: memberError } = await requireMember(user!.id, id);
  if (memberError) return memberError;

  // Get all conversations the user participates in for this production
  const userConvos = await db
    .select({ conversationId: conversationParticipants.conversationId })
    .from(conversationParticipants)
    .innerJoin(conversations, eq(conversationParticipants.conversationId, conversations.id))
    .where(
      and(
        eq(conversationParticipants.userId, user!.id),
        eq(conversations.productionId, id)
      )
    );

  if (userConvos.length === 0) return NextResponse.json([]);

  const convoIds = userConvos.map((c) => c.conversationId);

  // For each conversation, get the other participant and latest message
  const result = [];
  for (const convoId of convoIds) {
    const [otherParticipant] = await db
      .select({ userId: conversationParticipants.userId, name: users.name, role: productionMembers.role })
      .from(conversationParticipants)
      .innerJoin(users, eq(conversationParticipants.userId, users.id))
      .innerJoin(productionMembers, and(
        eq(productionMembers.userId, conversationParticipants.userId),
        eq(productionMembers.productionId, id)
      ))
      .where(
        and(
          eq(conversationParticipants.conversationId, convoId),
          ne(conversationParticipants.userId, user!.id)
        )
      )
      .limit(1);

    const [latestMessage] = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, convoId))
      .orderBy(desc(messages.createdAt))
      .limit(1);

    // Unread count
    const [unread] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, convoId),
          ne(messages.senderId, user!.id),
          eq(messages.isRead, false)
        )
      );

    result.push({
      conversationId: convoId,
      participant: otherParticipant ?? null,
      lastMessage: latestMessage ?? null,
      unreadCount: unread?.count ?? 0,
    });
  }

  // Sort by last message time descending
  result.sort((a, b) => {
    const aTime = a.lastMessage?.createdAt?.getTime() ?? 0;
    const bTime = b.lastMessage?.createdAt?.getTime() ?? 0;
    return bTime - aTime;
  });

  return NextResponse.json(result);
}

// POST: Create or find existing conversation (deduplication)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const { member, error: memberError } = await requireMember(user!.id, id);
  if (memberError) return memberError;

  let body: { participantId?: string };
  try {
    body = await request.json();
  } catch {
    return apiError(400, "VALIDATION_ERROR", "Invalid JSON body");
  }

  const participantId = body.participantId;
  if (!participantId) {
    return apiError(400, "VALIDATION_ERROR", "participantId is required");
  }

  // Verify participant is a member
  const [participantMember] = await db
    .select({ role: productionMembers.role })
    .from(productionMembers)
    .where(and(eq(productionMembers.productionId, id), eq(productionMembers.userId, participantId)))
    .limit(1);

  if (!participantMember) {
    return apiError(404, "NOT_FOUND", "Participant not found");
  }

  // Cast-to-cast blocking (SPEC-005 Section 8)
  if (member!.role === "cast" && participantMember.role === "cast") {
    return forbidden("Cast members cannot message other cast members");
  }

  // Deduplication: find existing conversation (SPEC-005 Section 3.1)
  const existingConvo = await db.transaction(async (tx) => {
    // Find conversations where both users are participants in this production
    const myConvos = await tx
      .select({ conversationId: conversationParticipants.conversationId })
      .from(conversationParticipants)
      .innerJoin(conversations, eq(conversationParticipants.conversationId, conversations.id))
      .where(
        and(
          eq(conversationParticipants.userId, user!.id),
          eq(conversations.productionId, id)
        )
      );

    if (myConvos.length === 0) return null;

    const myConvoIds = myConvos.map((c) => c.conversationId);

    const [match] = await tx
      .select({ conversationId: conversationParticipants.conversationId })
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.userId, participantId),
          inArray(conversationParticipants.conversationId, myConvoIds)
        )
      )
      .limit(1);

    return match?.conversationId ?? null;
  });

  if (existingConvo) {
    return NextResponse.json({ conversationId: existingConvo });
  }

  // Create new conversation
  const convo = await db.transaction(async (tx) => {
    const [newConvo] = await tx.insert(conversations).values({
      productionId: id,
    }).returning();

    await tx.insert(conversationParticipants).values([
      { conversationId: newConvo.id, userId: user!.id },
      { conversationId: newConvo.id, userId: participantId },
    ]);

    return newConvo;
  });

  return NextResponse.json({ conversationId: convo.id }, { status: 201 });
}
