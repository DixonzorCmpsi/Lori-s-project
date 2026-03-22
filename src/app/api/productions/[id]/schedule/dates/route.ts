import { rejectIfArchived } from "@/server/auth/archive-guard";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { rehearsalDates, bulletinPosts } from "@/server/db/schema";
import { requireAuth, requireRole } from "@/server/auth/rbac";
import { apiError, validationError } from "@/server/api-error";

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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "VALIDATION_ERROR", "Invalid JSON body");
  }

  const { date, startTime, endTime, type } = body as {
    date?: string; startTime?: string; endTime?: string; type?: string;
  };

  if (!date || !startTime || !endTime || !type) {
    return validationError([{ field: "date", message: "date, startTime, endTime, and type are required" }]);
  }

  if (!["regular", "tech", "dress", "performance"].includes(type)) {
    return validationError([{ field: "type", message: "Type must be regular, tech, dress, or performance" }]);
  }

  if (startTime >= endTime) {
    return validationError([{ field: "endTime", message: "End time must be after start time" }]);
  }

  const [newDate] = await db.insert(rehearsalDates).values({
    productionId: id,
    date,
    startTime,
    endTime,
    type,
  }).returning();

  // System bulletin post
  await db.insert(bulletinPosts).values({
    productionId: id,
    authorId: user!.id,
    title: "Schedule Updated",
    body: `Rehearsal added: ${date} ${startTime}-${endTime} (${type})`,
  });

  return NextResponse.json(newDate, { status: 201 });
}
