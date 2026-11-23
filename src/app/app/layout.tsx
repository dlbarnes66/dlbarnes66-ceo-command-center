import Link from "next/link";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { getTenant } from "@/lib/tenant";
import { PLANS } from "@/lib/plans";
import { Nav } from "@/components/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getTenant({ requireAccess: false });
  const entities = await db.query.entities.findMany({
    columns: { id: true, name: true },
    where: and(eq(schema.entities.workspaceId, ctx.workspace.id), isNull(schema.entities.archivedAt)),
    orderBy: asc(schema.entities.createdAt),
  });

  const ws = ctx.workspace;
  const trialDays =
    ws.plan === "trial" && ws.trialEndsAt ? Math.max(0, Math.ceil((ws.trialEndsAt.getTime() - Date.now()) / 86_400_000)) : null;

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 border-r border-line bg-stone-50/60 p-4 md:flex">
        <OrganizationSwitcher
          hidePersonal
          afterSelectOrganizationUrl="/app"
          afterCreateOrganizationUrl="/app"
          appearance={{ elements: { rootBox: "w-full", organizationSwitcherTrigger: "w-full justify-between" } }}
        />
        <div className="flex-1 overflow-y-auto">
          <Nav entities={entities} />
        </div>
        <div className="flex items-center justify-between">
          <UserButton />
          <span className="text-xs text-ink-muted">{PLANS[ws.plan].name}</span>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        {trialDays !== null && (
          <div className="border-b border-line bg-amber-50 px-6 py-2 text-sm text-amber-900">
            {trialDays > 0 ? `${trialDays} days left in your trial.` : "Your trial has ended."}{" "}
            <Link href="/app/settings/billing" className="font-medium underline">Choose a plan</Link>
          </div>
        )}
        <div className="flex items-center justify-between border-b border-line px-4 py-3 md:hidden">
          <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/app" />
          <UserButton />
        </div>
        <details className="border-b border-line px-4 py-2 md:hidden">
          <summary className="cursor-pointer text-sm font-medium">Menu</summary>
          <div className="py-3">
            <Nav entities={entities} />
          </div>
        </details>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
