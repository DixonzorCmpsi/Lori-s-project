import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { productions, theaters, productionMembers, rehearsalDates } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { productionSchema } from "@/shared/validators";
import { requireAuth } from "@/server/auth/rbac";
import { apiError, validationError, conflict, forbidden } from "@/server/api-error";
import { generateSchedule, type ScheduleInput } from "@/shared/schedule/generator";

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  const result = await db
    .select({
      id: productions.id,
      name: productions.name,
      theaterId: productions.theaterId,
      estimatedCastSize: productions.estimatedCastSize,
      firstRehearsal: productions.firstRehearsal,
      openingNight: productions.openingNight,
      closingNight: productions.closingNight,
      isArchived: productions.isArchived,
      createdAt: productions.createdAt,
    })
    .from(productions)
    .innerJoin(productionMembers, eq(productions.id, productionMembers.productionId))
    .where(eq(productionMembers.userId, user!.id));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "VALIDATION_ERROR", "Invalid JSON body");
  }

  const parsed = productionSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues.map((i) => ({
      field: String(i.path[0] ?? "unknown"),
      message: i.message,
    })));
  }

  const { name, estimatedCastSize, firstRehearsal, openingNight, closingNight } = parsed.data;

  if (firstRehearsal > openingNight) {
    return validationError([{ field: "openingNight", message: "Opening night must be on or after first rehearsal" }]);
  }
  if (openingNight > closingNight) {
    return validationError([{ field: "closingNight", message: "Closing night must be on or after opening night" }]);
  }

  const [theater] = await db
    .select({ id: theaters.id })
    .from(theaters)
    .where(eq(theaters.ownerId, user!.id))
    .limit(1);

  if (!theater) {
    return forbidden("You must create a theater first.");
  }

  const [existingActive] = await db
    .select({ id: productions.id })
    .from(productions)
    .innerJoin(productionMembers, eq(productions.id, productionMembers.productionId))
    .where(
      and(
        eq(productionMembers.userId, user!.id),
        eq(productionMembers.role, "director"),
        eq(productions.isArchived, false)
      )
    )
    .limit(1);

  if (existingActive) {
    return conflict("You already have an active production.");
  }

  // Create production + auto-join + schedule in a single transaction (SPEC-003 Section 8.1)
  const production = await db.transaction(async (tx) => {
    const [prod] = await tx.insert(productions).values({
      theaterId: theater.id,
      name,
      estimatedCastSize,
      firstRehearsal,
      openingNight,
      closingNight,
    }).returning();

    await tx.insert(productionMembers).values({
      productionId: prod.id,
      userId: user!.id,
      role: "director",
    });

    // Generate schedule if wizard data is present
    const selectedDays = body.selectedDays as number[] | undefined;
    const wizardStartTime = body.startTime as string | undefined;
    const wizardEndTime = body.endTime as string | undefined;

    if (selectedDays && wizardStartTime && wizardEndTime) {
      const scheduleInput: ScheduleInput = {
        firstRehearsal,
        openingNight,
        closingNight,
        selectedDays,
        startTime: wizardStartTime,
        endTime: wizardEndTime,
        blockedDates: (body.blockedDates as string[]) || [],
        techWeekEnabled: Boolean(body.techWeekEnabled),
        techWeekDays: (body.techWeekDays as number) || 5,
        dressRehearsalEnabled: Boolean(body.dressRehearsalEnabled),
      };

      const result = generateSchedule(scheduleInput);

      if (result.dates.length > 0) {
        await tx.insert(rehearsalDates).values(
          result.dates.map((d) => ({
            productionId: prod.id,
            date: d.date,
            startTime: d.startTime,
            endTime: d.endTime,
            type: d.type,
          }))
        );
      }
    }

    return prod;
  });

  return NextResponse.json(production, { status: 201 });
}
