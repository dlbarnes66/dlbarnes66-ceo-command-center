import "server-only";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { planForPriceId } from "./plans";

/** The platform's own Stripe account, used only for SaaS billing. */
export function platformStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

export async function ensureCustomer(ws: schema.Workspace, email?: string | null) {
  if (ws.stripeCustomerId) return ws.stripeCustomerId;
  const customer = await platformStripe().customers.create({
    name: ws.name,
    email: email ?? undefined,
    metadata: { workspaceId: ws.id, clerkOrgId: ws.clerkOrgId },
  });
  await db.update(schema.workspaces).set({ stripeCustomerId: customer.id }).where(eq(schema.workspaces.id, ws.id));
  return customer.id;
}

/** Mirrors a Stripe subscription onto the workspace. Called from the webhook. */
export async function applySubscription(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const item = sub.items.data[0];
  const plan = planForPriceId(item?.price.id);
  const periodEnd = item?.current_period_end;
  const ended = sub.status === "canceled" || sub.status === "incomplete_expired";

  await db
    .update(schema.workspaces)
    .set({
      stripeSubscriptionId: ended ? null : sub.id,
      subscriptionStatus: sub.status,
      ...(plan && !ended ? { plan } : {}),
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    })
    .where(eq(schema.workspaces.stripeCustomerId, customerId));
}
