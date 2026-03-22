import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/server/auth/rbac";
import { computeAge, deriveAgeRange } from "@/server/auth/age-gate";
import { apiError, validationError } from "@/server/api-error";

export async function POST(request: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  let body: { dateOfBirth?: string };
  try {
    body = await request.json();
  } catch {
    return apiError(400, "VALIDATION_ERROR", "Invalid JSON body");
  }

  if (!body.dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(body.dateOfBirth)) {
    return validationError([{ field: "dateOfBirth", message: "Invalid date format (YYYY-MM-DD)" }]);
  }

  const age = computeAge(body.dateOfBirth);
  if (age === null) {
    return validationError([{ field: "dateOfBirth", message: "Invalid date of birth" }]);
  }

  const ageRange = deriveAgeRange(age);
  if (ageRange === null) {
    return validationError([{ field: "dateOfBirth", message: "You must be 13 or older to use this app" }]);
  }

  await db.update(users).set({ ageRange }).where(eq(users.id, user!.id));

  return NextResponse.json({ ageRange });
}
