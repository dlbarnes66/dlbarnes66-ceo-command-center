import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  numeric,
  date,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";

export const planEnum = pgEnum("plan", ["trial", "starter", "professional", "executive", "enterprise"]);
export const entityKindEnum = pgEnum("entity_kind", [
  "fund",
  "nonprofit",
  "saas",
  "real_estate",
  "operating",
  "holding",
  "other",
]);
export const providerEnum = pgEnum("provider", ["stripe", "supabase_app"]);
export const connectionStatusEnum = pgEnum("connection_status", ["pending", "connected", "error"]);
export const unitEnum = pgEnum("metric_unit", ["usd", "count", "percent", "months"]);
export const obligationCategoryEnum = pgEnum("obligation_category", [
  "compliance",
  "tax",
  "investor",
  "grant",
  "legal",
  "finance",
  "operations",
  "other",
]);
export const obligationStatusEnum = pgEnum("obligation_status", ["open", "done"]);

/** One workspace per Clerk Organization. This is the tenant boundary. */
export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkOrgId: text("clerk_org_id").notNull().unique(),
  name: text("name").notNull(),
  plan: planEnum("plan").notNull().default("trial"),
  subscriptionStatus: text("subscription_status").notNull().default("trialing"),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A legal entity / business the CEO oversees. Records never mix across entities. */
export const entities = pgTable(
  "entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    legalName: text("legal_name"),
    kind: entityKindEnum("kind").notNull().default("operating"),
    jurisdiction: text("jurisdiction"),
    description: text("description"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("entities_workspace_idx").on(t.workspaceId)],
);

/** A data source attached to one entity. Secrets are AES-256-GCM encrypted at rest. */
export const connections = pgTable(
  "connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    entityId: uuid("entity_id").notNull().references(() => entities.id, { onDelete: "cascade" }),
    provider: providerEnum("provider").notNull(),
    label: text("label").notNull(),
    config: jsonb("config").$type<Record<string, string>>().notNull().default({}),
    secretCiphertext: text("secret_ciphertext").notNull(),
    status: connectionStatusEnum("status").notNull().default("pending"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("connections_workspace_idx").on(t.workspaceId), index("connections_entity_idx").on(t.entityId)],
);

/** Append-only metric history. Latest row per (entity, key) is the current value. */
export const metricSnapshots = pgTable(
  "metric_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    entityId: uuid("entity_id").notNull().references(() => entities.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id").references(() => connections.id, { onDelete: "set null" }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    value: numeric("value", { precision: 20, scale: 4 }).notNull(),
    unit: unitEnum("unit").notNull(),
    source: text("source").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("snapshots_entity_key_idx").on(t.entityId, t.key, t.capturedAt),
    index("snapshots_workspace_idx").on(t.workspaceId, t.capturedAt),
  ],
);

/** Deadlines and commitments: filings, investor reports, grant reports, renewals. */
export const obligations = pgTable(
  "obligations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    entityId: uuid("entity_id").notNull().references(() => entities.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id").references(() => connections.id, { onDelete: "cascade" }),
    externalId: text("external_id"),
    title: text("title").notNull(),
    category: obligationCategoryEnum("category").notNull().default("other"),
    dueDate: date("due_date").notNull(),
    status: obligationStatusEnum("status").notNull().default("open"),
    ownerName: text("owner_name"),
    notes: text("notes"),
    source: text("source").notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("obligations_workspace_due_idx").on(t.workspaceId, t.dueDate),
    uniqueIndex("obligations_connection_external_uq").on(t.connectionId, t.externalId),
  ],
);

export type BriefingItem = {
  heading: string;
  body: string;
  severity: "info" | "attention" | "urgent";
  entityName?: string;
  sources: string[];
};

export const briefings = pgTable(
  "briefings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    summary: text("summary").notNull(),
    items: jsonb("items").$type<BriefingItem[]>().notNull(),
    model: text("model").notNull(),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("briefings_workspace_idx").on(t.workspaceId, t.createdAt)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id"),
    action: text("action").notNull(),
    target: text("target"),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_workspace_idx").on(t.workspaceId, t.createdAt)],
);

export type Workspace = typeof workspaces.$inferSelect;
export type Entity = typeof entities.$inferSelect;
export type Connection = typeof connections.$inferSelect;
export type MetricSnapshot = typeof metricSnapshots.$inferSelect;
export type Obligation = typeof obligations.$inferSelect;
export type Briefing = typeof briefings.$inferSelect;
