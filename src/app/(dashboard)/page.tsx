import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { theaters, productions, productionMembers } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { format } from "date-fns";
import { Sidebar } from "@/components/layout/sidebar";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) return null; // layout handles redirect

  const userId = session.user.id;

  const userTheaters = await db
    .select()
    .from(theaters)
    .where(eq(theaters.ownerId, userId));

  const userProductions = await db
    .select({
      id: productions.id,
      name: productions.name,
      openingNight: productions.openingNight,
      estimatedCastSize: productions.estimatedCastSize,
      isArchived: productions.isArchived,
      theaterName: theaters.name,
      role: productionMembers.role,
    })
    .from(productionMembers)
    .innerJoin(productions, eq(productionMembers.productionId, productions.id))
    .innerJoin(theaters, eq(productions.theaterId, theaters.id))
    .where(eq(productionMembers.userId, userId));

  // Count cast members per production
  const hasTheater = userTheaters.length > 0;
  const hasProductions = userProductions.length > 0;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-serif font-bold">Your Productions</h1>

      {!hasTheater && (
        <div className="mt-12 text-center py-16 rounded-md" style={{
          background: "radial-gradient(ellipse at center, hsl(38 75% 55% / 0.05), transparent 70%)"
        }}>
          <p className="text-muted-foreground text-lg">No theaters yet.</p>
          <Link
            href="/theater/new"
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/80"
          >
            Add your first theater
          </Link>
        </div>
      )}

      {hasTheater && !hasProductions && (
        <div className="mt-12 text-center py-16 rounded-md" style={{
          background: "radial-gradient(ellipse at center, hsl(38 75% 55% / 0.05), transparent 70%)"
        }}>
          <p className="text-muted-foreground text-lg">No productions yet.</p>
          <Link
            href="/production/new"
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/80"
          >
            Create your first production
          </Link>
        </div>
      )}

      {hasProductions && (
        <div className="mt-6 grid gap-4">
          {userProductions.map((prod) => (
            <Link
              key={prod.id}
              href={prod.role === "cast" ? `/production/${prod.id}/bulletin` : `/production/${prod.id}`}
              className="block rounded-md border border-border bg-card p-5 hover:bg-surface-raised transition-colors"
            >
              <h2 className="text-lg font-serif font-semibold">{prod.name}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {prod.theaterName}
                {prod.isArchived && <span className="ml-2 text-warning">(Archived)</span>}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Opens: {format(new Date(prod.openingNight), "MMM d")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
      </main>
    </div>
  );
}
