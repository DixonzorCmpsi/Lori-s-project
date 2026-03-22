import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { castProfiles } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireMember } from "@/server/auth/rbac";
import { castProfileSchema } from "@/shared/validators";
import { apiError, validationError, notFound } from "@/server/api-error";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const { error: memberError } = await requireMember(user!.id, id);
  if (memberError) return memberError;

  const [profile] = await db
    .select()
    .from(castProfiles)
    .where(and(eq(castProfiles.productionId, id), eq(castProfiles.userId, user!.id)))
    .limit(1);

  return NextResponse.json(profile ?? null);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const { error: memberError } = await requireMember(user!.id, id);
  if (memberError) return memberError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "VALIDATION_ERROR", "Invalid JSON body");
  }

  const parsed = castProfileSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues.map((i) => ({
      field: String(i.path[0] ?? "unknown"),
      message: i.message,
    })));
  }

  const [profile] = await db.insert(castProfiles).values({
    productionId: id,
    userId: user!.id,
    displayName: parsed.data.displayName,
    phone: parsed.data.phone || null,
    roleCharacter: parsed.data.roleCharacter || null,
  }).returning();

  return NextResponse.json(profile, { status: 201 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const { error: memberError } = await requireMember(user!.id, id);
  if (memberError) return memberError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "VALIDATION_ERROR", "Invalid JSON body");
  }

  const parsed = castProfileSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues.map((i) => ({
      field: String(i.path[0] ?? "unknown"),
      message: i.message,
    })));
  }

  const [updated] = await db
    .update(castProfiles)
    .set({
      displayName: parsed.data.displayName,
      phone: parsed.data.phone || null,
      roleCharacter: parsed.data.roleCharacter || null,
    })
    .where(and(eq(castProfiles.productionId, id), eq(castProfiles.userId, user!.id)))
    .returning();

  if (!updated) return notFound("Profile not found");
  return NextResponse.json(updated);
}
