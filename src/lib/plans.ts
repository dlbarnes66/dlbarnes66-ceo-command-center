export type PlanId = "trial" | "starter" | "professional" | "executive" | "enterprise";

export const PLANS: Record<PlanId, { name: string; entityLimit: number; priceLabel: string; blurb: string }> = {
  trial: { name: "Trial", entityLimit: 5, priceLabel: "Free for 14 days", blurb: "Everything in Professional" },
  starter: { name: "Starter", entityLimit: 2, priceLabel: "$79/mo", blurb: "Up to 2 businesses" },
  professional: { name: "Professional", entityLimit: 5, priceLabel: "$199/mo", blurb: "Up to 5 businesses" },
  executive: { name: "Executive", entityLimit: 15, priceLabel: "$449/mo", blurb: "Up to 15 businesses" },
  enterprise: { name: "Enterprise", entityLimit: 1000, priceLabel: "Custom", blurb: "Holding companies and family offices" },
};

export const SELF_SERVE_PLANS = ["starter", "professional", "executive"] as const;
export type SelfServePlan = (typeof SELF_SERVE_PLANS)[number];

export function priceIdFor(plan: SelfServePlan): string {
  const id = {
    starter: process.env.STRIPE_PRICE_STARTER,
    professional: process.env.STRIPE_PRICE_PROFESSIONAL,
    executive: process.env.STRIPE_PRICE_EXECUTIVE,
  }[plan];
  if (!id) throw new Error(`Stripe price for ${plan} is not configured`);
  return id;
}

export function planForPriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  for (const plan of SELF_SERVE_PLANS) {
    if (priceId === process.env[`STRIPE_PRICE_${plan.toUpperCase()}`]) return plan;
  }
  return null;
}

const ACTIVE = new Set(["active", "trialing", "past_due"]);

export function hasAccess(ws: { plan: PlanId; subscriptionStatus: string; trialEndsAt: Date | null }): boolean {
  if (ws.plan === "enterprise") return true;
  if (ws.plan === "trial") return !!ws.trialEndsAt && ws.trialEndsAt.getTime() > Date.now();
  return ACTIVE.has(ws.subscriptionStatus);
}
