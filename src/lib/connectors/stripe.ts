import "server-only";
import Stripe from "stripe";
import type { Connector, ConnectorInput, ConnectorResult } from "./types";
import { STANDARD_KEYS } from "./types";

/**
 * Reads an entity's own Stripe account using a restricted, read-only key
 * (rk_live_… with read access to Balance, Subscriptions, Balance transactions).
 * Never writes to Stripe.
 */
function client(secret: string) {
  return new Stripe(secret, { maxNetworkRetries: 2, timeout: 20_000, appInfo: { name: "CEO Command Center" } });
}

const MAX_ITEMS = 5000;

function monthlyAmount(item: Stripe.SubscriptionItem): number {
  const price = item.price;
  const unit = price.unit_amount ?? Number(price.unit_amount_decimal ?? 0);
  const qty = item.quantity ?? 1;
  const recurring = price.recurring;
  if (!recurring) return 0;
  const perInterval = (unit * qty) / 100;
  const count = recurring.interval_count || 1;
  switch (recurring.interval) {
    case "day":
      return (perInterval * 30) / count;
    case "week":
      return (perInterval * 52) / 12 / count;
    case "month":
      return perInterval / count;
    case "year":
      return perInterval / 12 / count;
    default:
      return 0;
  }
}

export const stripeConnector: Connector = {
  provider: "stripe",
  sourceName: (config) => `Stripe${config.accountName ? ` (${config.accountName})` : ""}`,

  async test({ secret }: ConnectorInput) {
    if (!/^(rk|sk)_(live|test)_/.test(secret)) throw new Error("That doesn't look like a Stripe API key.");
    await client(secret).balance.retrieve();
  },

  async fetch({ secret }: ConnectorInput): Promise<ConnectorResult> {
    const stripe = client(secret);
    const now = Math.floor(Date.now() / 1000);

    const balance = await stripe.balance.retrieve();
    const usdAvailable =
      balance.available.filter((b) => b.currency === "usd").reduce((sum, b) => sum + b.amount, 0) / 100;

    let mrr = 0;
    let activeSubs = 0;
    let seen = 0;
    for await (const sub of stripe.subscriptions.list({ status: "active", limit: 100 })) {
      if (++seen > MAX_ITEMS) break;
      if (sub.currency !== "usd") continue;
      activeSubs++;
      for (const item of sub.items.data) mrr += monthlyAmount(item);
    }

    let cancellations = 0;
    seen = 0;
    const weekAgo = now - 7 * 86400;
    for await (const sub of stripe.subscriptions.list({ status: "canceled", limit: 100 })) {
      if (++seen > MAX_ITEMS) break;
      if ((sub.canceled_at ?? 0) >= weekAgo) cancellations++;
    }

    let netVolume = 0;
    seen = 0;
    const countable = new Set(["charge", "payment", "refund", "payment_refund", "adjustment", "payment_failure_refund"]);
    for await (const txn of stripe.balanceTransactions.list({ created: { gte: now - 30 * 86400 }, limit: 100 })) {
      if (++seen > MAX_ITEMS) break;
      if (txn.currency === "usd" && countable.has(txn.type)) netVolume += txn.net / 100;
    }

    return {
      metrics: [
        { key: STANDARD_KEYS.mrr, label: "MRR", value: Math.round(mrr * 100) / 100, unit: "usd" },
        { key: STANDARD_KEYS.activeCustomers, label: "Active subscriptions", value: activeSubs, unit: "count" },
        { key: STANDARD_KEYS.cancellations7d, label: "Cancellations (7d)", value: cancellations, unit: "count" },
        { key: STANDARD_KEYS.netVolume30d, label: "Net volume (30d)", value: Math.round(netVolume * 100) / 100, unit: "usd" },
        { key: STANDARD_KEYS.stripeBalance, label: "Stripe available balance", value: usdAvailable, unit: "usd" },
      ],
      obligations: [],
    };
  },
};
