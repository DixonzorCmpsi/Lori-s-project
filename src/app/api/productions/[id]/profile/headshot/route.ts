import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { castProfiles } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireMember } from "@/server/auth/rbac";
import { apiError, notFound } from "@/server/api-error";
import { validateImageMagicBytes, uploadHeadshot, deleteHeadshot } from "@/server/storage";
import sharp from "sharp";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const { error: memberError } = await requireMember(user!.id, id);
  if (memberError) return memberError;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return apiError(400, "VALIDATION_ERROR", "No file provided");

  // Size check
  if (file.size > MAX_SIZE) {
    return apiError(413, "PAYLOAD_TOO_LARGE", "File must be under 5MB");
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Magic byte validation (not extension or MIME)
  const ext = validateImageMagicBytes(buffer);
  if (!ext) {
    return apiError(400, "VALIDATION_ERROR", "Only JPEG and PNG files are accepted");
  }

  // Strip EXIF with sharp
  let processed: Buffer;
  try {
    processed = await sharp(buffer).rotate().toBuffer();
  } catch {
    return apiError(400, "VALIDATION_ERROR", "Invalid image file");
  }

  // Delete old headshot if exists
  const [profile] = await db
    .select({ headshotUrl: castProfiles.headshotUrl })
    .from(castProfiles)
    .where(and(eq(castProfiles.productionId, id), eq(castProfiles.userId, user!.id)))
    .limit(1);

  if (profile?.headshotUrl) {
    await deleteHeadshot(profile.headshotUrl);
  }

  // Upload
  const filename = await uploadHeadshot(processed, ext);

  // Update profile
  await db
    .update(castProfiles)
    .set({ headshotUrl: filename })
    .where(and(eq(castProfiles.productionId, id), eq(castProfiles.userId, user!.id)));

  return NextResponse.json({ headshotUrl: filename }, { status: 201 });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const { error: memberError } = await requireMember(user!.id, id);
  if (memberError) return memberError;

  const [profile] = await db
    .select({ headshotUrl: castProfiles.headshotUrl })
    .from(castProfiles)
    .where(and(eq(castProfiles.productionId, id), eq(castProfiles.userId, user!.id)))
    .limit(1);

  if (!profile) return notFound("Profile not found");

  if (profile.headshotUrl) {
    await deleteHeadshot(profile.headshotUrl);
    await db
      .update(castProfiles)
      .set({ headshotUrl: null })
      .where(and(eq(castProfiles.productionId, id), eq(castProfiles.userId, user!.id)));
  }

  return NextResponse.json({ success: true });
}
