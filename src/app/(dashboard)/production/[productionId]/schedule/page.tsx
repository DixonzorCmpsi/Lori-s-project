import { redirect, notFound } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { rehearsalDates, productionMembers, castConflicts } from "@/server/db/schema";
import { eq, and, count } from "drizzle-orm";
import { format } from "date-fns";

const typeColors: Record<string, string> = {
  regular: "bg-amber-600/20 text-amber-400 border-amber-600/30",
  tech: "bg-blue-600/20 text-blue-400 border-blue-600/30",
  dress: "bg-purple-600/20 text-purple-400 border-purple-600/30",
  performance: "bg-red-600/20 text-red-400 border-red-600/30 ring-1 ring-amber-500/30",
};

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ productionId: string }>;
}) {
  const { productionId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [member] = await db
    .select({ role: productionMembers.role })
    .from(productionMembers)
    .where(
      and(
        eq(productionMembers.productionId, productionId),
        eq(productionMembers.userId, session.user.id)
      )
    )
    .limit(1);

  if (!member) notFound();

  const isCast = member.role === "cast";
  const isDirectorOrStaff = !isCast;

  // Fetch rehearsal dates (cast doesn't see deleted)
  const dates = await db
    .select()
    .from(rehearsalDates)
    .where(
      isCast
        ? and(eq(rehearsalDates.productionId, productionId), eq(rehearsalDates.isDeleted, false))
        : eq(rehearsalDates.productionId, productionId)
    )
    .orderBy(rehearsalDates.date);

  // For cast: get own conflicts
  let userConflictDateIds: Set<string> = new Set();
  if (isCast) {
    const conflicts = await db
      .select({ rehearsalDateId: castConflicts.rehearsalDateId })
      .from(castConflicts)
      .where(
        and(
          eq(castConflicts.productionId, productionId),
          eq(castConflicts.userId, session.user.id)
        )
      );
    userConflictDateIds = new Set(conflicts.map((c) => c.rehearsalDateId));
  }

  // For director/staff: get conflict counts per date
  let conflictCounts: Map<string, number> = new Map();
  if (isDirectorOrStaff) {
    const counts = await db
      .select({
        rehearsalDateId: castConflicts.rehearsalDateId,
        count: count(),
      })
      .from(castConflicts)
      .where(eq(castConflicts.productionId, productionId))
      .groupBy(castConflicts.rehearsalDateId);

    for (const c of counts) {
      conflictCounts.set(c.rehearsalDateId, c.count);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-serif font-bold">Schedule</h1>

      {/* Color legend */}
      <div className="flex flex-wrap gap-3 mt-4 text-xs">
        {Object.entries({ regular: "Regular", tech: "Tech", dress: "Dress", performance: "Performance" }).map(([type, label]) => (
          <span key={type} className={`rounded-full px-2 py-0.5 font-medium ${typeColors[type]}`}>{label}</span>
        ))}
        {isCast && <span className="rounded-full px-2 py-0.5 font-medium bg-red-500/20 text-red-400">Your conflict</span>}
      </div>

      {dates.length === 0 ? (
        <div className="mt-12 text-center py-16" style={{
          background: "radial-gradient(ellipse at center, hsl(38 75% 55% / 0.05), transparent 70%)"
        }}>
          <p className="text-muted-foreground">No rehearsal dates yet.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {dates.map((d) => {
            const hasConflict = userConflictDateIds.has(d.id);
            const conflictCount = conflictCounts.get(d.id) ?? 0;
            const isCancelled = d.isCancelled;
            const isDeleted = d.isDeleted;

            return (
              <div
                key={d.id}
                className={`flex items-center justify-between rounded-md border px-4 py-3 ${
                  hasConflict ? "bg-red-500/10 border-red-500/30" :
                  isCancelled ? "bg-muted/50 border-border" :
                  isDeleted ? "bg-muted/30 border-border opacity-50" :
                  "bg-card border-border"
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className={`font-mono text-sm ${isCancelled ? "line-through text-muted-foreground" : ""}`}>
                      {format(new Date(d.date + "T00:00:00"), "MMM d EEE")}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {d.startTime}–{d.endTime}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeColors[d.type] ?? ""}`}>
                      {d.type}
                    </span>
                    {isCancelled && <span className="text-xs text-muted-foreground">(Cancelled)</span>}
                    {hasConflict && <span className="text-xs text-red-400">You&apos;re unavailable</span>}
                  </div>
                  {d.note && <p className="text-xs text-muted-foreground mt-1">{d.note}</p>}
                </div>

                {isDirectorOrStaff && conflictCount > 0 && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    conflictCount >= 5 ? "bg-red-600/20 text-red-400" :
                    conflictCount >= 3 ? "bg-orange-600/20 text-orange-400" :
                    conflictCount >= 1 ? "bg-amber-600/20 text-amber-400" :
                    "bg-green-600/20 text-green-400"
                  }`}>
                    {conflictCount} unavailable
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
