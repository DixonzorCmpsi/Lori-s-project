import { db } from "@/server/db";
import { productions } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { forbidden } from "@/server/api-error";
import { NextResponse } from "next/server";

/**
 * Check if a production is archived. If so, return a 403 response.
 * Call this at the top of any write endpoint (POST, PATCH, DELETE on sub-resources).
 */
export async function rejectIfArchived(productionId: string): Promise<NextResponse | null> {
  const [prod] = await db
    .select({ isArchived: productions.isArchived })
    .from(productions)
    .where(eq(productions.id, productionId))
    .limit(1);

  if (prod?.isArchived) {
    return forbidden("Production is archived (read-only)");
  }

  return null;
}
