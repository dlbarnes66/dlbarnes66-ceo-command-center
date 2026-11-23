import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { applySubscription, platformStripe } from "@/lib/billing";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!secret || !signature) return NextResponse.json({ error: "Not configured" }, { status: 400 });

  const stripe = platformStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode === "subscription" && session.subscription && session.client_reference_id) {
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
        if (customerId) {
          await db
            .update(schema.workspaces)
            .set({ stripeCustomerId: customerId })
            .where(eq(schema.workspaces.id, session.client_reference_id));
        }
        const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        await applySubscription(await stripe.subscriptions.retrieve(subId));
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await applySubscription(event.data.object);
      break;
  }

  return NextResponse.json({ received: true });
}
