import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { inviteTokens } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "@/server/auth/rbac";
import { randomBytes } from "crypto";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const { error: roleError } = await requireRole(user!.id, id, ["director", "staff"]);
  if (roleError) return roleError;

  const [token] = await db
    .select()
    .from(inviteTokens)
    .where(eq(inviteTokens.productionId, id))
    .orderBy(inviteTokens.createdAt)
    .limit(1);

  return NextResponse.json(token ?? null);
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const { error: roleError } = await requireRole(user!.id, id, ["director", "staff"]);
  if (roleError) return roleError;

  // Invalidate previous tokens
  await db.delete(inviteTokens).where(eq(inviteTokens.productionId, id));

  // Generate new cryptographically random token (min 32 chars, URL-safe)
  const token = randomBytes(32).toString("base64url");

  const [invite] = await db.insert(inviteTokens).values({
    productionId: id,
    token,
  }).returning();

  return NextResponse.json(invite, { status: 201 });
}
