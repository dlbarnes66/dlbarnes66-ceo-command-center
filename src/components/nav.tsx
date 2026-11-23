"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { LayoutDashboard, CalendarClock, Plug, CreditCard, Users, ScrollText, Building2 } from "lucide-react";

const ITEMS = [
  { href: "/app", label: "Portfolio", icon: LayoutDashboard, exact: true },
  { href: "/app/obligations", label: "Deadlines", icon: CalendarClock },
  { href: "/app/connections", label: "Connections", icon: Plug },
  { href: "/app/settings/team", label: "Team", icon: Users },
  { href: "/app/settings/billing", label: "Billing", icon: CreditCard },
  { href: "/app/audit", label: "Audit log", icon: ScrollText },
];

export function Nav({ entities }: { entities: { id: string; name: string }[] }) {
  const path = usePathname();
  const active = (href: string, exact?: boolean) => (exact ? path === href : path.startsWith(href));
  return (
    <nav className="space-y-6 text-sm">
      <div className="space-y-0.5">
        {ITEMS.map(({ href, label, icon: Icon, exact }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex items-center gap-2 rounded-md px-2 py-1.5",
              active(href, exact) ? "bg-stone-200/70 font-medium text-ink" : "text-ink-soft hover:bg-stone-100",
            )}
          >
            <Icon size={16} aria-hidden /> {label}
          </Link>
        ))}
      </div>
      <div>
        <div className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-ink-muted">Businesses</div>
        <div className="space-y-0.5">
          {entities.map((e) => (
            <Link
              key={e.id}
              href={`/app/entities/${e.id}`}
              className={clsx(
                "flex items-center gap-2 truncate rounded-md px-2 py-1.5",
                path === `/app/entities/${e.id}` ? "bg-stone-200/70 font-medium" : "text-ink-soft hover:bg-stone-100",
              )}
            >
              <Building2 size={16} aria-hidden /> <span className="truncate">{e.name}</span>
            </Link>
          ))}
          <Link href="/app/entities/new" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-ink-muted hover:bg-stone-100">
            + Add business
          </Link>
        </div>
      </div>
    </nav>
  );
}
