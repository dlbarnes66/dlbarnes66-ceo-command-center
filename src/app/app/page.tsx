import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { loadPortfolio, latestBriefing } from "@/lib/portfolio";
import { formatValue } from "@/lib/format";
import { EntityCard } from "@/components/entity-card";
import { BriefingPanel } from "@/components/briefing";
import { ObligationList } from "@/components/obligation-list";
import { Empty, PageHeader, Stat } from "@/components/ui";
import { syncAllAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const ctx = await getTenant();
  const [portfolio, briefing] = await Promise.all([loadPortfolio(ctx.workspace.id), latestBriefing(ctx.workspace.id)]);
  const { totals, entities, upcoming } = portfolio;

  if (!entities.length) {
    return (
      <>
        <PageHeader title="Portfolio" sub={ctx.workspace.name} />
        <Empty
          title="Add your first business"
          body="Each business keeps its own records, connections and deadlines. You'll see them all side by side here."
          action={<Link href="/app/entities/new" className="btn-primary">Add business</Link>}
        />
      </>
    );
  }

  const hasCash = entities.some((e) => e.metrics.some((m) => m.key === "cash"));

  return (
    <>
      <PageHeader
        title="Portfolio"
        sub={`${ctx.workspace.name} · ${entities.length} ${entities.length === 1 ? "business" : "businesses"}`}
        actions={
          <form action={syncAllAction}>
            <button className="btn">
              <RefreshCw size={15} aria-hidden /> Sync all
            </button>
          </form>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Reported cash"
          value={hasCash ? formatValue(totals.reportedCash, "usd") : "—"}
          sub={hasCash ? "From connected apps" : "No app reports cash yet"}
        />
        <Stat label="MRR" value={formatValue(totals.mrr, "usd")} sub="Across Stripe accounts" />
        <Stat label="Due in 30 days" value={String(totals.due30)} sub={totals.overdue ? `${totals.overdue} overdue` : "None overdue"} />
        <Stat label="Need attention" value={String(totals.needsAttention)} sub={`of ${entities.length} businesses`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <BriefingPanel
            briefing={
              briefing
                ? { summary: briefing.summary, items: briefing.items, createdAt: briefing.createdAt.toISOString(), model: briefing.model }
                : null
            }
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {entities.map((v) => (
              <EntityCard key={v.entity.id} view={v} />
            ))}
          </div>
        </div>
        <aside className="lg:col-span-2">
          <section className="card p-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="h2">Next 60 days</h2>
              <Link href="/app/obligations" className="btn-ghost">All deadlines</Link>
            </div>
            <ObligationList rows={upcoming.slice(0, 12)} compact />
          </section>
        </aside>
      </div>
    </>
  );
}
