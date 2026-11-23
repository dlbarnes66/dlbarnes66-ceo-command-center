import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { decryptSecret } from "./crypto";
import { connectors } from "./connectors";

export async function syncConnection(connectionId: string, workspaceId: string) {
  const conn = await db.query.connections.findFirst({
    where: and(eq(schema.connections.id, connectionId), eq(schema.connections.workspaceId, workspaceId)),
  });
  if (!conn) throw new Error("Connection not found");

  const connector = connectors[conn.provider];
  const source = connector.sourceName(conn.config);

  try {
    const result = await connector.fetch({ secret: decryptSecret(conn.secretCiphertext), config: conn.config });
    const capturedAt = new Date();

    await db.transaction(async (tx) => {
      if (result.metrics.length) {
        await tx.insert(schema.metricSnapshots).values(
          result.metrics.map((m) => ({
            workspaceId: conn.workspaceId,
            entityId: conn.entityId,
            connectionId: conn.id,
            key: m.key,
            label: m.label,
            value: String(m.value),
            unit: m.unit,
            source,
            capturedAt,
          })),
        );
      }
      for (const o of result.obligations) {
        await tx
          .insert(schema.obligations)
          .values({
            workspaceId: conn.workspaceId,
            entityId: conn.entityId,
            connectionId: conn.id,
            externalId: o.externalId,
            title: o.title,
            category: o.category,
            dueDate: o.dueDate,
            status: o.status,
            ownerName: o.ownerName ?? null,
            source,
          })
          .onConflictDoUpdate({
            target: [schema.obligations.connectionId, schema.obligations.externalId],
            set: {
              title: sql`excluded.title`,
              category: sql`excluded.category`,
              dueDate: sql`excluded.due_date`,
              status: sql`excluded.status`,
              ownerName: sql`excluded.owner_name`,
            },
          });
      }
      await tx
        .update(schema.connections)
        .set({ status: "connected", lastSyncedAt: capturedAt, lastError: null })
        .where(eq(schema.connections.id, conn.id));
    });

    return { ok: true as const, metrics: result.metrics.length, obligations: result.obligations.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    await db
      .update(schema.connections)
      .set({ status: "error", lastError: message.slice(0, 500) })
      .where(eq(schema.connections.id, conn.id));
    return { ok: false as const, error: message };
  }
}

export async function syncWorkspace(workspaceId: string) {
  const conns = await db.query.connections.findMany({ where: eq(schema.connections.workspaceId, workspaceId) });
  const results = [];
  for (const c of conns) results.push({ id: c.id, ...(await syncConnection(c.id, workspaceId)) });
  return results;
}
