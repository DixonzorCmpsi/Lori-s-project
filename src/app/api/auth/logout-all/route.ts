import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "@/server/auth/rbac";

export async function POST() {
  const { user, error } = await requireAuth();
  if (error) return error;

  // Increment token_version — all existing JWTs become stale
  await db.update(users).set({
    tokenVersion: sql`${users.tokenVersion} + 1`,
  }).where(eq(users.id, user!.id));

  return NextResponse.json({ message: "All sessions invalidated. Please log in again." });
}
