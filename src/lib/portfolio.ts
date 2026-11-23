import "server-only";
import { and, asc, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { STANDARD_KEYS } from "./connectors/types";

export type MetricView = {
  key: string;
  label: string;
  unit: string;
  value: number;
  previous?: number;
  source: string;
  capturedAt: Date;
  derived?: boolean;
};

export type EntityView = {
  entity: schema.Entity;
  metrics: MetricView[];
  connections: schema.Connection[];
  openObligations: number;
  overdueObligations: number;
  dueSoon: number;
  health: "healthy" | "attention" | "urgent" | "no_data";
  flags: string[];
};

const HISTORY_DAYS = 60;

function isoDay(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** Latest value per key plus the most recent value from an earlier sync, for deltas. */
function latestMetrics(rows: schema.MetricSnapshot[]): MetricView[] {
  const byKey = new Map<string, schema.MetricSnapshot[]>();
  for (const r of rows) {
    const list = byKey.get(r.key) ?? [];
    list.push(r);
    byKey.set(r.key, list);
  }
  const out: MetricView[] = [];
  for (const [key, list] of byKey) {
    list.sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime());
    const [latest] = list;
    const prev = list.find((r) => r.capturedAt.getTime() < latest.capturedAt.getTime() - 12 * 3600_000);
    out.push({
      key,
      label: latest.label,
      unit: latest.unit,
      value: Number(latest.value),
      previous: prev ? Number(prev.value) : undefined,
      source: latest.source,
      capturedAt: latest.capturedAt,
    });
  }

  const cash = out.find((m) => m.key === STANDARD_KEYS.cash);
  const burn = out.find((m) => m.key === STANDARD_KEYS.monthlyBurn);
  if (cash && burn && burn.value > 0 && !out.some((m) => m.key === STANDARD_KEYS.runway)) {
    out.push({
      key: STANDARD_KEYS.runway,
      label: "Runway",
      unit: "months",
      value: cash.value / burn.value,
      source: `Derived from ${cash.source}`,
      capturedAt: cash.capturedAt,
      derived: true,
    });
  }
  const order = Object.values(STANDARD_KEYS) as string[];
  return out.sort((a, b) => {
    const ia = order.indexOf(a.key);
    const ib = order.indexOf(b.key);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.label.localeCompare(b.label);
  });
}

function assessHealth(metrics: MetricView[], overdue: number, dueSoon: number, conns: schema.Connection[]) {
  const flags: string[] = [];
  let level = 0;
  const runway = metrics.find((m) => m.key === STANDARD_KEYS.runway);
  if (runway && runway.value < 6) {
    flags.push(`Runway ${runway.value.toFixed(1)} months`);
    level = Math.max(level, runway.value < 3 ? 2 : 1);
  }
  const mrr = metrics.find((m) => m.key === STANDARD_KEYS.mrr);
  if (mrr?.previous && mrr.value < mrr.previous * 0.97) {
    flags.push("MRR down since last sync");
    level = Math.max(level, 1);
  }
  if (overdue > 0) {
    flags.push(`${overdue} overdue`);
    level = 2;
  }
  if (dueSoon > 0) {
    flags.push(`${dueSoon} due in 14 days`);
    level = Math.max(level, 1);
  }
  if (conns.some((c) => c.status === "error")) {
    flags.push("Connection error");
    level = Math.max(level, 1);
  }
  const health: EntityView["health"] =
    metrics.length === 0 && conns.length === 0 ? "no_data" : (["healthy", "attention", "urgent"] as const)[level];
  return { health, flags };
}

export async function loadPortfolio(workspaceId: string) {
  const since = new Date(Date.now() - HISTORY_DAYS * 86_400_000);
  const today = isoDay(0);

  const [entities, connections, snapshots, upcoming] = await Promise.all([
    db.query.entities.findMany({
      where: and(eq(schema.entities.workspaceId, workspaceId), isNull(schema.entities.archivedAt)),
      orderBy: asc(schema.entities.createdAt),
    }),
    db.query.connections.findMany({ where: eq(schema.connections.workspaceId, workspaceId) }),
    db.query.metricSnapshots.findMany({
      where: and(eq(schema.metricSnapshots.workspaceId, workspaceId), gte(schema.metricSnapshots.capturedAt, since)),
    }),
    db.query.obligations.findMany({
      where: and(
        eq(schema.obligations.workspaceId, workspaceId),
        eq(schema.obligations.status, "open"),
        lte(schema.obligations.dueDate, isoDay(60)),
      ),
      orderBy: asc(schema.obligations.dueDate),
    }),
  ]);

  const views: EntityView[] = entities.map((entity) => {
    const metrics = latestMetrics(snapshots.filter((s) => s.entityId === entity.id));
    const conns = connections.filter((c) => c.entityId === entity.id);
    const obs = upcoming.filter((o) => o.entityId === entity.id);
    const overdue = obs.filter((o) => o.dueDate < today).length;
    const dueSoon = obs.filter((o) => o.dueDate >= today && o.dueDate <= isoDay(14)).length;
    return {
      entity,
      metrics,
      connections: conns,
      openObligations: obs.length,
      overdueObligations: overdue,
      dueSoon,
      ...assessHealth(metrics, overdue, dueSoon, conns),
    };
  });

  const sum = (key: string) =>
    views.reduce((acc, v) => acc + (v.metrics.find((m) => m.key === key)?.value ?? 0), 0);

  const totals = {
    reportedCash: sum(STANDARD_KEYS.cash),
    monthlyBurn: sum(STANDARD_KEYS.monthlyBurn),
    mrr: sum(STANDARD_KEYS.mrr),
    due30: upcoming.filter((o) => o.dueDate <= isoDay(30)).length,
    overdue: upcoming.filter((o) => o.dueDate < today).length,
    needsAttention: views.filter((v) => v.health === "attention" || v.health === "urgent").length,
  };

  const entityName = new Map(entities.map((e) => [e.id, e.name]));
  return {
    entities: views,
    totals,
    upcoming: upcoming.map((o) => ({ ...o, entityName: entityName.get(o.entityId) ?? "Unknown" })),
  };
}

export type Portfolio = Awaited<ReturnType<typeof loadPortfolio>>;

export async function latestBriefing(workspaceId: string) {
  return db.query.briefings.findFirst({
    where: eq(schema.briefings.workspaceId, workspaceId),
    orderBy: desc(schema.briefings.createdAt),
  });
}
