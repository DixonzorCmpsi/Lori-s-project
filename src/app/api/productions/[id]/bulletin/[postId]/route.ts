import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { bulletinPosts } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "@/server/auth/rbac";
import { bulletinPostSchema } from "@/shared/validators";
import { apiError, validationError, notFound, forbidden } from "@/server/api-error";
import { sanitizeMarkdown } from "@/server/markdown";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; postId: string }> }
) {
  const { id, postId } = await params;
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const { member, error: roleError } = await requireRole(user!.id, id, ["director", "staff"]);
  if (roleError) return roleError;

  // Get the post to check ownership
  const [post] = await db
    .select()
    .from(bulletinPosts)
    .where(and(eq(bulletinPosts.id, postId), eq(bulletinPosts.productionId, id)))
    .limit(1);

  if (!post) return notFound("Post not found");

  // Staff can only edit their own posts. Director can edit any.
  if (member!.role === "staff" && post.authorId !== user!.id) {
    return forbidden("Staff can only edit their own posts");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "VALIDATION_ERROR", "Invalid JSON body");
  }

  const parsed = bulletinPostSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues.map((i) => ({
      field: String(i.path[0] ?? "unknown"),
      message: i.message,
    })));
  }

  const sanitizedBody = sanitizeMarkdown(parsed.data.body);

  const [updated] = await db
    .update(bulletinPosts)
    .set({ title: parsed.data.title, body: sanitizedBody })
    .where(and(eq(bulletinPosts.id, postId), eq(bulletinPosts.productionId, id)))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; postId: string }> }
) {
  const { id, postId } = await params;
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const { member, error: roleError } = await requireRole(user!.id, id, ["director", "staff"]);
  if (roleError) return roleError;

  const [post] = await db
    .select({ authorId: bulletinPosts.authorId })
    .from(bulletinPosts)
    .where(and(eq(bulletinPosts.id, postId), eq(bulletinPosts.productionId, id)))
    .limit(1);

  if (!post) return notFound("Post not found");

  // Staff can only delete their own. Director can delete any.
  if (member!.role === "staff" && post.authorId !== user!.id) {
    return forbidden("Staff can only delete their own posts");
  }

  await db.delete(bulletinPosts).where(and(eq(bulletinPosts.id, postId), eq(bulletinPosts.productionId, id)));

  return NextResponse.json({ success: true });
}
