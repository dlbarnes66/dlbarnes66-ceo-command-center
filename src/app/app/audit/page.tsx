import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getTenant } from "@/lib/tenant";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const ctx = await getTenant();
  const rows = await db.query.auditLog.findMany({
    where: eq(schema.auditLog.workspaceId, ctx.workspace.id),
    orderBy: desc(schema.auditLog.createdAt),
    limit: 200,
  });
  return (
    <>
      <PageHeader title="Audit log" sub="Every change and sync in this workspace, newest first." />
      <section className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-ink-muted">
            <tr className="border-b border-line">
              <th className="px-4 py-2 font-medium">When</th>
              <th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 font-medium">Actor</th>
              <th className="px-4 py-2 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="whitespace-nowrap px-4 py-2 text-ink-soft">{r.createdAt.toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}</td>
                <td className="px-4 py-2 font-mono text-xs">{r.action}</td>
                <td className="px-4 py-2 font-mono text-xs text-ink-soft">{r.actorUserId ?? "system"}</td>
                <td className="px-4 py-2 text-xs text-ink-soft">{Object.keys(r.meta).length ? JSON.stringify(r.meta) : r.target ?? ""}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-ink-muted">No activity yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
