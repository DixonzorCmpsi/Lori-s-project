"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Megaphone, Calendar, MessageSquare } from "lucide-react";

type MobileNavProps = {
  productionId: string;
};

const cn = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(" ");

export function MobileNav({ productionId }: MobileNavProps) {
  const pathname = usePathname();
  const base = `/production/${productionId}`;

  const tabs = [
    { href: `${base}/bulletin`, icon: Megaphone, label: "Bulletin" },
    { href: `${base}/schedule`, icon: Calendar, label: "Schedule" },
    { href: `${base}/chat`, icon: MessageSquare, label: "Chat" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 md:hidden border-t border-border bg-background z-50">
      <div className="flex justify-around">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center gap-1 py-3 px-4 text-xs min-w-[80px]",
                active ? "text-accent" : "text-muted-foreground"
              )}
            >
              <tab.icon className="h-5 w-5" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
