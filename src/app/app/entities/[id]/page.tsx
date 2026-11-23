import { notFound } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { getTenant } from "@/lib/tenant";
import { loadPortfolio } from "@/lib/portfolio";
import { formatDelta, formatValue, relativeTime } from "@/lib/format";
import { Badge, HEALTH, KIND_LABEL, PageHeader } from "@/components/ui";
import { ConnectionForm } from "@/components/connection-form";
import { ConnectionRow } from "@/components/connection-row";
import { ObligationForm } from "@/components/obligation-form";
import { ObligationList } from "@/components/obligation-list";
import { EntityForm } from "@/components/entity-form";
import { archiveEntity } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EntityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const ctx = await getTenant();
  const portfolio = await loadPortfolio(ctx.workspace.id);
  const view = portfolio.entities.find((v) => v.entity.id === id);
  if (!view) notFound();
  const { entity } = view;

  const obligations = await db.query.obligations.findMany({
    where: and(eq(schema.obligations.workspaceId, ctx.workspace.id), eq(schema.obligations.entityId, id)),
    orderBy: [asc(schema.obligations.status), asc(schema.obligations.dueDate)],
    limit: 100,
  });
  const h = HEALTH[view.health];

  return (
    <>
      <PageHeader
        title={entity.name}
        sub={[KIND_LABEL[entity.kind], entity.legalName, entity.jurisdiction].filter(Boolean).join(" · ")}
        actions={<Badge tone={h.tone}>{h.label}</Badge>}
      />
      {entity.description && <p className="muted -mt-3 mb-6 max-w-3xl">{entity.description}</p>}

      <section className="mb-6">
        <h2 className="h2 mb-3">Numbers</h2>
        {view.metrics.length ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {view.metrics.map((m) => {
              const d = formatDelta(m.value, m.previous);
              return (
                <div key={m.key} className="rounded-xl bg-stone-100/70 p-4">
                  <div className="text-sm text-ink-soft">{m.label}</div>
                  <div className="mt-1 text-xl font-semibold tracking-tight">
                    {formatValue(m.value, m.unit)}
                    {d && (
                      <span className={`ml-2 text-xs font-medium ${d.tone === "up" ? "text-emerald-700" : d.tone === "down" ? "text-red-700" : "text-ink-muted"}`}>
                        {d.text}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-ink-muted">
                    {m.source} · {relativeTime(m.capturedAt)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="muted">No numbers yet. Add a connection below.</p>
        )}
        {view.flags.length > 0 && <p className="mt-3 text-sm text-amber-800">{view.flags.join(" · ")}</p>}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="h2 mb-2">Deadlines</h2>
          <ObligationList rows={obligations} showEntity={false} />
          <details className="mt-4 border-t border-line pt-4">
            <summary className="cursor-pointer text-sm font-medium">Add a deadline</summary>
            <div className="mt-4">
              <ObligationForm entities={[]} fixedEntityId={entity.id} />
            </div>
          </details>
        </section>

        <section className="card p-5">
          <h2 className="h2 mb-2">Connections</h2>
          {view.connections.length ? (
            <ul className="divide-y divide-line">
              {view.connections.map((c) => (
                <ConnectionRow key={c.id} c={c} canManage={ctx.isAdmin} />
              ))}
            </ul>
          ) : (
            <p className="muted">Nothing connected yet.</p>
          )}
          {ctx.isAdmin && (
            <details className="mt-4 border-t border-line pt-4" open={!view.connections.length}>
              <summary className="cursor-pointer text-sm font-medium">Add a connection</summary>
              <div className="mt-4">
                <ConnectionForm entities={[]} fixedEntityId={entity.id} />
              </div>
            </details>
          )}
        </section>
      </div>

      {ctx.isAdmin && (
        <section className="card mt-6 p-5">
          <details>
            <summary className="cursor-pointer text-sm font-medium">Edit business details</summary>
            <div className="mt-4 max-w-2xl">
              <EntityForm initial={entity} />
              <form action={archiveEntity} className="mt-6 border-t border-line pt-4">
                <input type="hidden" name="id" value={entity.id} />
                <button className="btn text-red-700">Archive this business</button>
                <p className="hint">Archived businesses leave the portfolio view. Their history is kept.</p>
              </form>
            </div>
          </details>
        </section>
      )}
    </>
  );
}
