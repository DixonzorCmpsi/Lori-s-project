import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Check if user needs to complete age gate (Google OAuth users with NULL age_range)
  const [user] = await db
    .select({ ageRange: users.ageRange })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (user && user.ageRange === null) {
    redirect("/complete-profile");
  }

  // No sidebar here — child layouts (production/[id]/layout.tsx) render their own
  // context-aware sidebar. Top-level pages (dashboard, theater/new) render inline.
  return <>{children}</>;
}
