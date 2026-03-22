import { rejectIfArchived } from "@/server/auth/archive-guard";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { bulletinPosts, users } from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, requireMember, requireRole } from "@/server/auth/rbac";
import { bulletinPostSchema } from "@/shared/validators";
import { apiError, validationError } from "@/server/api-error";
import { sanitizeMarkdown } from "@/server/markdown";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const { error: memberError } = await requireMember(user!.id, id);
  if (memberError) return memberError;

  // Pinned first, then newest-first within each group
  const posts = await db
    .select({
      id: bulletinPosts.id,
      title: bulletinPosts.title,
      body: bulletinPosts.body,
      isPinned: bulletinPosts.isPinned,
      createdAt: bulletinPosts.createdAt,
      updatedAt: bulletinPosts.updatedAt,
      authorId: bulletinPosts.authorId,
      authorName: users.name,
    })
    .from(bulletinPosts)
    .innerJoin(users, eq(bulletinPosts.authorId, users.id))
    .where(eq(bulletinPosts.productionId, id))
    .orderBy(desc(bulletinPosts.isPinned), desc(bulletinPosts.createdAt));

  return NextResponse.json(posts);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const { error: roleError } = await requireRole(user!.id, id, ["director", "staff"]);
  if (roleError) return roleError;

  const archiveErr = await rejectIfArchived(id);
  if (archiveErr) return archiveErr;

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

  // Sanitize Markdown before storage (SPEC-003 Section 6.2)
  const sanitizedBody = sanitizeMarkdown(parsed.data.body);

  const [post] = await db.insert(bulletinPosts).values({
    productionId: id,
    authorId: user!.id,
    title: parsed.data.title,
    body: sanitizedBody,
  }).returning();

  return NextResponse.json(post, { status: 201 });
}
