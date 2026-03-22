import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { bulletinPosts } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "@/server/auth/rbac";
import { notFound } from "@/server/api-error";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; postId: string }> }
) {
  const { id, postId } = await params;
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const { error: roleError } = await requireRole(user!.id, id, ["director", "staff"]);
  if (roleError) return roleError;

  const [post] = await db
    .select({ isPinned: bulletinPosts.isPinned })
    .from(bulletinPosts)
    .where(and(eq(bulletinPosts.id, postId), eq(bulletinPosts.productionId, id)))
    .limit(1);

  if (!post) return notFound("Post not found");

  const newPinState = !post.isPinned;

  // If pinning, unpin all others first (only one pinned at a time)
  if (newPinState) {
    await db
      .update(bulletinPosts)
      .set({ isPinned: false })
      .where(and(eq(bulletinPosts.productionId, id), eq(bulletinPosts.isPinned, true)));
  }

  const [updated] = await db
    .update(bulletinPosts)
    .set({ isPinned: newPinState })
    .where(and(eq(bulletinPosts.id, postId), eq(bulletinPosts.productionId, id)))
    .returning();

  return NextResponse.json(updated);
}
