import { and, asc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { getTenant } from "@/lib/tenant";
import { ObligationList } from "@/components/obligation-list";
import { ObligationForm } from "@/components/obligation-form";
import { Empty, PageHeader } from "@/components/ui";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ObligationsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show } = await searchParams;
  const ctx = await getTenant();
  const entities = await db.query.entities.findMany({
    columns: { id: true, name: true },
    where: and(eq(schema.entities.workspaceId, ctx.workspace.id), isNull(schema.entities.archivedAt)),
    orderBy: asc(schema.entities.createdAt),
  });
  const names = new Map(entities.map((e) => [e.id, e.name]));
  const rows = await db.query.obligations.findMany({
    where: and(
      eq(schema.obligations.workspaceId, ctx.workspace.id),
      show === "done" ? eq(schema.obligations.status, "done") : eq(schema.obligations.status, "open"),
    ),
    orderBy: asc(schema.obligations.dueDate),
    limit: 500,
  });
  const visible = rows.filter((r) => names.has(r.entityId)).map((r) => ({ ...r, entityName: names.get(r.entityId) }));

  return (
    <>
      <PageHeader
        title="Deadlines"
        sub="Filings, investor reports, grant reports and renewals across every business."
        actions={
          <div className="flex gap-1">
            <Link href="/app/obligations" className={show === "done" ? "btn-ghost" : "btn"}>Open</Link>
            <Link href="/app/obligations?show=done" className={show === "done" ? "btn" : "btn-ghost"}>Done</Link>
          </div>
        }
      />
      {!entities.length ? (
        <Empty title="Add a business first" body="Deadlines belong to a business." action={<Link className="btn-primary" href="/app/entities/new">Add business</Link>} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="card p-5 lg:col-span-2">
            <ObligationList rows={visible} />
          </section>
          <section className="card h-fit p-5">
            <h2 className="h2 mb-4">Add a deadline</h2>
            <ObligationForm entities={entities} />
          </section>
        </div>
      )}
    </>
  );
}
