import Link from "next/link";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { getTenant } from "@/lib/tenant";
import { ConnectionForm } from "@/components/connection-form";
import { ConnectionRow } from "@/components/connection-row";
import { Empty, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage() {
  const ctx = await getTenant();
  const [entities, conns] = await Promise.all([
    db.query.entities.findMany({
      columns: { id: true, name: true },
      where: and(eq(schema.entities.workspaceId, ctx.workspace.id), isNull(schema.entities.archivedAt)),
      orderBy: asc(schema.entities.createdAt),
    }),
    db.query.connections.findMany({
      where: eq(schema.connections.workspaceId, ctx.workspace.id),
      orderBy: asc(schema.connections.createdAt),
    }),
  ]);
  const names = new Map(entities.map((e) => [e.id, e.name]));

  return (
    <>
      <PageHeader title="Connections" sub="Read-only links to Stripe and your own apps. Credentials are encrypted at rest." />
      {!entities.length ? (
        <Empty title="Add a business first" body="Each connection belongs to one business." action={<Link className="btn-primary" href="/app/entities/new">Add business</Link>} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card p-5">
            <h2 className="h2 mb-2">Connected sources</h2>
            {conns.length ? (
              <ul className="divide-y divide-line">
                {conns.map((c) => (
                  <ConnectionRow key={c.id} c={c} entityName={names.get(c.entityId)} canManage={ctx.isAdmin} />
                ))}
              </ul>
            ) : (
              <p className="muted">Nothing connected yet.</p>
            )}
          </section>
          <section className="card p-5">
            <h2 className="h2 mb-4">Add a connection</h2>
            {ctx.isAdmin ? <ConnectionForm entities={entities} /> : <p className="muted">Only workspace admins can add connections.</p>}
            <p className="hint mt-6">
              To connect one of your Supabase apps, install the snapshot function from{" "}
              <code>docs/supabase-app-contract.sql</code> in that app first.
            </p>
          </section>
        </div>
      )}
    </>
  );
}
