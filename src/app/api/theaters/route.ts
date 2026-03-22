import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { theaters } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { theaterSchema } from "@/shared/validators";
import { requireAuth } from "@/server/auth/rbac";
import { apiError, validationError, conflict } from "@/server/api-error";

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  const result = await db
    .select()
    .from(theaters)
    .where(eq(theaters.ownerId, user!.id));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "VALIDATION_ERROR", "Invalid JSON body");
  }

  const parsed = theaterSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues.map((i) => ({
      field: String(i.path[0] ?? "unknown"),
      message: i.message,
    })));
  }

  // One-theater guard (SPEC-003)
  const [existing] = await db
    .select({ id: theaters.id })
    .from(theaters)
    .where(eq(theaters.ownerId, user!.id))
    .limit(1);

  if (existing) {
    return conflict("You already have a theater.");
  }

  const [theater] = await db.insert(theaters).values({
    ownerId: user!.id,
    name: parsed.data.name,
    city: parsed.data.city,
    state: parsed.data.state,
  }).returning();

  return NextResponse.json(theater, { status: 201 });
}
