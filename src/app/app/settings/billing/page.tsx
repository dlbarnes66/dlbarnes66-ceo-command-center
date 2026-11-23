import { count, and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { getTenant } from "@/lib/tenant";
import { PLANS, SELF_SERVE_PLANS, hasAccess } from "@/lib/plans";
import { Badge, PageHeader } from "@/components/ui";
import { openBillingPortal, startCheckout } from "../../actions";

export const dynamic = "force-dynamic";

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ success?: string; expired?: string }> }) {
  const sp = await searchParams;
  const ctx = await getTenant({ requireAccess: false });
  const ws = ctx.workspace;
  const [{ n }] = await db
    .select({ n: count() })
    .from(schema.entities)
    .where(and(eq(schema.entities.workspaceId, ws.id), isNull(schema.entities.archivedAt)));
  const active = hasAccess(ws);

  return (
    <>
      <PageHeader title="Billing" sub={`${ws.name} · ${n} of ${PLANS[ws.plan].entityLimit} businesses used`} />
      {sp.success && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">Thanks. Your plan updates as soon as Stripe confirms the payment.</p>}
      {(sp.expired || !active) && (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Your workspace doesn&apos;t have an active plan. Choose one to keep using the dashboard.
        </p>
      )}

      <section className="card mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="h2">{PLANS[ws.plan].name}</span>
            <Badge tone={active ? "success" : "warning"}>{ws.plan === "trial" ? (active ? "Trial" : "Trial ended") : ws.subscriptionStatus}</Badge>
          </div>
          <p className="muted mt-1">
            {ws.plan === "trial" && ws.trialEndsAt
              ? `Trial ends ${ws.trialEndsAt.toLocaleDateString("en-US", { dateStyle: "medium" })}`
              : ws.currentPeriodEnd
                ? `Renews ${ws.currentPeriodEnd.toLocaleDateString("en-US", { dateStyle: "medium" })}`
                : PLANS[ws.plan].blurb}
          </p>
        </div>
        {ctx.isAdmin && ws.stripeCustomerId && (
          <form action={openBillingPortal}>
            <button className="btn">Manage billing</button>
          </form>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        {SELF_SERVE_PLANS.map((id) => {
          const p = PLANS[id];
          const current = ws.plan === id && active;
          return (
            <div key={id} className={`card p-5 ${current ? "border-2 border-ink" : ""}`}>
              <div className="h2">{p.name}</div>
              <div className="mt-2 text-2xl font-semibold">{p.priceLabel}</div>
              <p className="muted mt-1">{p.blurb}</p>
              {ctx.isAdmin && !current && (
                <form action={startCheckout} className="mt-4">
                  <input type="hidden" name="plan" value={id} />
                  <button className="btn-primary w-full" disabled={n > p.entityLimit} title={n > p.entityLimit ? "Archive businesses to fit this plan" : undefined}>
                    {ws.stripeSubscriptionId ? "Switch" : "Choose"}
                  </button>
                </form>
              )}
              {current && <p className="mt-4 text-sm font-medium">Current plan</p>}
            </div>
          );
        })}
        <div className="card p-5">
          <div className="h2">{PLANS.enterprise.name}</div>
          <div className="mt-2 text-2xl font-semibold">{PLANS.enterprise.priceLabel}</div>
          <p className="muted mt-1">{PLANS.enterprise.blurb}</p>
          <a href="mailto:dlbarnes@vcgnow.com?subject=CEO%20Command%20Center%20Enterprise" className="btn mt-4 w-full">Contact us</a>
        </div>
      </div>
      {!ctx.isAdmin && <p className="muted mt-4">Ask a workspace admin to change the plan.</p>}
    </>
  );
}
