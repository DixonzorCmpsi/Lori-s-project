import { redirect, notFound } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { productions, theaters, productionMembers, rehearsalDates, castConflicts, conflictSubmissions } from "@/server/db/schema";
import { eq, and, count, gte, sql } from "drizzle-orm";
import { format } from "date-fns";

export default async function ProductionDashboardPage({
  params,
}: {
  params: Promise<{ productionId: string }>;
}) {
  const { productionId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [production] = await db
    .select()
    .from(productions)
    .where(eq(productions.id, productionId))
    .limit(1);

  if (!production) notFound();

  const [theater] = await db
    .select({ name: theaters.name })
    .from(theaters)
    .where(eq(theaters.id, production.theaterId))
    .limit(1);

  // Count members
  const [memberCount] = await db
    .select({ count: count() })
    .from(productionMembers)
    .where(eq(productionMembers.productionId, productionId));

  // Count conflict submissions
  const [submissionCount] = await db
    .select({ count: count() })
    .from(conflictSubmissions)
    .where(eq(conflictSubmissions.productionId, productionId));

  // Get upcoming rehearsals (next 5)
  const today = new Date().toISOString().split("T")[0];
  const upcoming = await db
    .select()
    .from(rehearsalDates)
    .where(
      and(
        eq(rehearsalDates.productionId, productionId),
        eq(rehearsalDates.isDeleted, false),
        gte(rehearsalDates.date, today)
      )
    )
    .orderBy(rehearsalDates.date)
    .limit(5);

  return (
    <div className="max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-serif font-bold">{production.name}</h1>
        <p className="text-muted-foreground mt-1">
          {theater?.name} | Opens {format(new Date(production.openingNight), "MMM d")}
        </p>
      </div>

      {/* Quick stats */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Cast" value={String(memberCount?.count ?? 0)} />
        <StatCard label="Conflicts Submitted" value={`${submissionCount?.count ?? 0}`} />
        <StatCard label="Rehearsals" value={String(upcoming.length)} sub="upcoming" />
      </div>

      {/* Upcoming schedule */}
      <div className="mt-8">
        <h2 className="text-xl font-serif font-semibold">Upcoming Schedule</h2>
        {upcoming.length === 0 ? (
          <p className="text-muted-foreground mt-4">No upcoming rehearsals.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {upcoming.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-md border border-border bg-card px-4 py-3"
              >
                <div>
                  <span className="font-mono text-sm">{format(new Date(r.date), "MMM d EEE")}</span>
                  <span className="ml-3 text-sm text-muted-foreground">
                    {r.startTime}–{r.endTime}
                  </span>
                </div>
                <TypeBadge type={r.type} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}{sub && ` ${sub}`}</p>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    regular: "bg-amber-600/20 text-amber-400",
    tech: "bg-blue-600/20 text-blue-400",
    dress: "bg-purple-600/20 text-purple-400",
    performance: "bg-red-600/20 text-red-400",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[type] ?? "bg-muted text-muted-foreground"}`}>
      {type}
    </span>
  );
}
