"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Megaphone, Users, MessageSquare, Settings, Home } from "lucide-react";

type SidebarProps = {
  productionId?: string;
  productionName?: string;
  role?: "director" | "staff" | "cast";
};

const cn = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(" ");

export function Sidebar({ productionId, productionName, role }: SidebarProps) {
  const pathname = usePathname();

  if (!productionId) {
    return (
      <aside className="hidden md:flex w-[260px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="border-l-[3px] border-curtain h-full flex flex-col">
          <div className="p-6">
            <Link href="/" className="text-lg font-serif font-bold">Digital Call Board</Link>
          </div>
          <nav className="flex-1 px-3 space-y-1">
            <SidebarLink href="/" icon={Home} label="Dashboard" active={pathname === "/"} />
          </nav>
          <SidebarFooter />
        </div>
      </aside>
    );
  }

  const base = `/production/${productionId}`;
  const isDirectorOrStaff = role === "director" || role === "staff";

  const links = [
    ...(isDirectorOrStaff ? [{ href: base, icon: Home, label: "Dashboard" }] : []),
    ...(isDirectorOrStaff ? [{ href: `${base}/schedule`, icon: Calendar, label: "Schedule" }] : []),
    { href: `${base}/bulletin`, icon: Megaphone, label: "Bulletin Board" },
    ...(isDirectorOrStaff ? [{ href: `${base}/roster`, icon: Users, label: "Members" }] : []),
    { href: `${base}/chat`, icon: MessageSquare, label: "Chat" },
    ...(role === "director" ? [{ href: `${base}/settings`, icon: Settings, label: "Settings" }] : []),
  ];

  return (
    <aside className="hidden md:flex w-[260px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="border-l-[3px] border-curtain h-full flex flex-col">
        <div className="p-6">
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
            &larr; Back to Dashboard
          </Link>
          <h2 className="mt-2 text-lg font-serif font-bold truncate">{productionName}</h2>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {links.map((link) => (
            <SidebarLink
              key={link.href}
              href={link.href}
              icon={link.icon}
              label={link.label}
              active={pathname === link.href}
            />
          ))}
        </nav>
        <SidebarFooter />
      </div>
    </aside>
  );
}

function SidebarLink({ href, icon: Icon, label, active }: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-primary font-medium"
          : "text-sidebar-foreground hover:bg-sidebar-accent/50"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

function SidebarFooter() {
  return (
    <div className="border-t border-sidebar-border p-3 space-y-1">
      <Link
        href="/account"
        className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50"
      >
        Account
      </Link>
    </div>
  );
}
