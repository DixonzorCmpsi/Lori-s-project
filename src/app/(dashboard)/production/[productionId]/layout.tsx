import { redirect, notFound } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { productions, theaters, productionMembers } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";

export default async function ProductionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ productionId: string }>;
}) {
  const { productionId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Verify membership
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

  // Get production name
  const [production] = await db
    .select({ name: productions.name })
    .from(productions)
    .where(eq(productions.id, productionId))
    .limit(1);

  if (!production) notFound();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        productionId={productionId}
        productionName={production.name}
        role={member.role as "director" | "staff" | "cast"}
      />
      <main className="flex-1 overflow-y-auto p-6 md:p-8 pb-24 md:pb-8">
        {children}
      </main>
      <MobileNav productionId={productionId} />
    </div>
  );
}
