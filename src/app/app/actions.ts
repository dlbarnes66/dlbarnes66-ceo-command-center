"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { and, count, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { getTenant, requireAdmin, audit } from "@/lib/tenant";
import { encryptSecret } from "@/lib/crypto";
import { connectors } from "@/lib/connectors";
import { syncConnection, syncWorkspace } from "@/lib/sync";
import { generateBriefing, askPortfolio } from "@/lib/ai";
import { PLANS, SELF_SERVE_PLANS, priceIdFor } from "@/lib/plans";
import { ensureCustomer, platformStripe } from "@/lib/billing";

export type ActionState = { error?: string; ok?: string; answer?: string } | undefined;

const fail = (err: unknown): ActionState => ({
  error: err instanceof z.ZodError ? err.issues[0]?.message ?? "Check the form." : err instanceof Error ? err.message : "Something went wrong.",
});

const str = (max = 200) => z.string().trim().max(max);
const optional = (max = 200) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : null));

async function ownedEntity(workspaceId: string, entityId: string) {
  const entity = await db.query.entities.findFirst({
    where: and(eq(schema.entities.id, entityId), eq(schema.entities.workspaceId, workspaceId)),
  });
  if (!entity) throw new Error("Business not found.");
  return entity;
}

/* ---------------- Entities ---------------- */

const entityInput = z.object({
  name: str(120).min(1, "Give the business a name."),
  legalName: optional(200),
  kind: z.enum(["fund", "nonprofit", "saas", "real_estate", "operating", "holding", "other"]),
  jurisdiction: optional(80),
  description: optional(500),
});

export async function createEntity(_: ActionState, form: FormData): Promise<ActionState> {
  let id: string;
  try {
    const ctx = await requireAdmin();
    const input = entityInput.parse(Object.fromEntries(form));
    const [{ n }] = await db
      .select({ n: count() })
      .from(schema.entities)
      .where(and(eq(schema.entities.workspaceId, ctx.workspace.id), isNull(schema.entities.archivedAt)));
    const limit = PLANS[ctx.workspace.plan].entityLimit;
    if (n >= limit) throw new Error(`Your ${PLANS[ctx.workspace.plan].name} plan covers ${limit} businesses. Upgrade to add more.`);
    const [row] = await db.insert(schema.entities).values({ ...input, workspaceId: ctx.workspace.id }).returning();
    await audit(ctx, "entity.created", row.id, { name: row.name });
    id = row.id;
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/app");
  redirect(`/app/entities/${id}`);
}

export async function updateEntity(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const ctx = await requireAdmin();
    const entityId = z.string().uuid().parse(form.get("id"));
    await ownedEntity(ctx.workspace.id, entityId);
    const input = entityInput.parse(Object.fromEntries(form));
    await db.update(schema.entities).set(input).where(eq(schema.entities.id, entityId));
    await audit(ctx, "entity.updated", entityId);
    revalidatePath(`/app/entities/${entityId}`);
    return { ok: "Saved" };
  } catch (e) {
    return fail(e);
  }
}

export async function archiveEntity(form: FormData) {
  const ctx = await requireAdmin();
  const entityId = z.string().uuid().parse(form.get("id"));
  await ownedEntity(ctx.workspace.id, entityId);
  await db.update(schema.entities).set({ archivedAt: new Date() }).where(eq(schema.entities.id, entityId));
  await audit(ctx, "entity.archived", entityId);
  revalidatePath("/app");
  redirect("/app");
}

/* ---------------- Connections ---------------- */

const connectionInput = z.discriminatedUnion("provider", [
  z.object({
    provider: z.literal("stripe"),
    entityId: z.string().uuid(),
    label: str(120).min(1),
    apiKey: z.string().trim().min(20, "Paste a restricted Stripe key."),
    accountName: optional(120),
  }),
  z.object({
    provider: z.literal("supabase_app"),
    entityId: z.string().uuid(),
    label: str(120).min(1),
    url: z.string().trim().url("Enter the Supabase project URL."),
    anonKey: z.string().trim().min(20, "Paste the project's anon key."),
    token: z.string().trim().min(16, "The connection token must be at least 16 characters."),
    entityRef: optional(120),
  }),
]);

export async function createConnection(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const ctx = await requireAdmin();
    const input = connectionInput.parse(Object.fromEntries(form));
    await ownedEntity(ctx.workspace.id, input.entityId);

    let secret: string;
    let config: Record<string, string>;
    if (input.provider === "stripe") {
      secret = input.apiKey;
      config = input.accountName ? { accountName: input.accountName } : {};
    } else {
      secret = JSON.stringify({ anonKey: input.anonKey, token: input.token });
      config = { url: input.url.replace(/\/$/, ""), appName: input.label, ...(input.entityRef ? { entityRef: input.entityRef } : {}) };
    }

    await connectors[input.provider].test({ secret, config });

    const [row] = await db
      .insert(schema.connections)
      .values({
        workspaceId: ctx.workspace.id,
        entityId: input.entityId,
        provider: input.provider,
        label: input.label,
        config,
        secretCiphertext: encryptSecret(secret),
        status: "pending",
      })
      .returning();
    await audit(ctx, "connection.created", row.id, { provider: row.provider, label: row.label });
    const result = await syncConnection(row.id, ctx.workspace.id);
    revalidatePath("/app", "layout");
    return result.ok
      ? { ok: `Connected. Pulled ${result.metrics} metrics and ${result.obligations} obligations.` }
      : { error: `Saved, but the first sync failed: ${result.error}` };
  } catch (e) {
    return fail(e);
  }
}

export async function syncConnectionAction(form: FormData) {
  const ctx = await getTenant();
  const id = z.string().uuid().parse(form.get("id"));
  await syncConnection(id, ctx.workspace.id);
  await audit(ctx, "connection.synced", id);
  revalidatePath("/app", "layout");
}

export async function syncAllAction() {
  const ctx = await getTenant();
  await syncWorkspace(ctx.workspace.id);
  await audit(ctx, "workspace.synced");
  revalidatePath("/app", "layout");
}

export async function deleteConnection(form: FormData) {
  const ctx = await requireAdmin();
  const id = z.string().uuid().parse(form.get("id"));
  await db
    .delete(schema.connections)
    .where(and(eq(schema.connections.id, id), eq(schema.connections.workspaceId, ctx.workspace.id)));
  await audit(ctx, "connection.deleted", id);
  revalidatePath("/app", "layout");
}

/* ---------------- Obligations ---------------- */

const obligationInput = z.object({
  entityId: z.string().uuid("Pick a business."),
  title: str(300).min(1, "Add a title."),
  category: z.enum(["compliance", "tax", "investor", "grant", "legal", "finance", "operations", "other"]),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a due date."),
  ownerName: optional(120),
  notes: optional(2000),
});

export async function createObligation(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const ctx = await getTenant();
    const input = obligationInput.parse(Object.fromEntries(form));
    await ownedEntity(ctx.workspace.id, input.entityId);
    const [row] = await db
      .insert(schema.obligations)
      .values({ ...input, workspaceId: ctx.workspace.id, source: "Manual entry" })
      .returning();
    await audit(ctx, "obligation.created", row.id, { title: row.title });
    revalidatePath("/app", "layout");
    return { ok: "Added" };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleObligation(form: FormData) {
  const ctx = await getTenant();
  const id = z.string().uuid().parse(form.get("id"));
  const ob = await db.query.obligations.findFirst({
    where: and(eq(schema.obligations.id, id), eq(schema.obligations.workspaceId, ctx.workspace.id)),
  });
  if (!ob) return;
  const status = ob.status === "open" ? "done" : "open";
  await db.update(schema.obligations).set({ status }).where(eq(schema.obligations.id, id));
  await audit(ctx, `obligation.${status === "done" ? "completed" : "reopened"}`, id);
  revalidatePath("/app", "layout");
}

export async function deleteObligation(form: FormData) {
  const ctx = await getTenant();
  const id = z.string().uuid().parse(form.get("id"));
  await db
    .delete(schema.obligations)
    .where(
      and(
        eq(schema.obligations.id, id),
        eq(schema.obligations.workspaceId, ctx.workspace.id),
        isNull(schema.obligations.connectionId),
      ),
    );
  await audit(ctx, "obligation.deleted", id);
  revalidatePath("/app", "layout");
}

/* ---------------- AI ---------------- */

export async function generateBriefingAction(_: ActionState): Promise<ActionState> {
  try {
    const ctx = await getTenant();
    await generateBriefing(ctx.workspace.id, ctx.userId);
    await audit(ctx, "briefing.generated");
    revalidatePath("/app");
    return { ok: "Briefing updated" };
  } catch (e) {
    return fail(e);
  }
}

export async function askAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const ctx = await getTenant();
    const question = str(1000).min(3, "Ask a question first.").parse(form.get("question") ?? "");
    const answer = await askPortfolio(ctx.workspace.id, question);
    await audit(ctx, "assistant.asked", undefined, { question });
    return { answer };
  } catch (e) {
    return fail(e);
  }
}

/* ---------------- Billing ---------------- */

export async function startCheckout(form: FormData) {
  const ctx = await getTenant({ requireAccess: false });
  if (!ctx.isAdmin) throw new Error("Only workspace admins can manage billing.");
  const plan = z.enum(SELF_SERVE_PLANS).parse(form.get("plan"));
  const user = await currentUser();
  const customer = await ensureCustomer(ctx.workspace, user?.primaryEmailAddress?.emailAddress);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const session = await platformStripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price: priceIdFor(plan), quantity: 1 }],
    allow_promotion_codes: true,
    client_reference_id: ctx.workspace.id,
    subscription_data: { metadata: { workspaceId: ctx.workspace.id } },
    success_url: `${appUrl}/app/settings/billing?success=1`,
    cancel_url: `${appUrl}/app/settings/billing`,
  });
  await audit(ctx, "billing.checkout_started", undefined, { plan });
  redirect(session.url!);
}

export async function openBillingPortal() {
  const ctx = await getTenant({ requireAccess: false });
  if (!ctx.isAdmin) throw new Error("Only workspace admins can manage billing.");
  if (!ctx.workspace.stripeCustomerId) redirect("/app/settings/billing");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const session = await platformStripe().billingPortal.sessions.create({
    customer: ctx.workspace.stripeCustomerId,
    return_url: `${appUrl}/app/settings/billing`,
  });
  redirect(session.url);
}
