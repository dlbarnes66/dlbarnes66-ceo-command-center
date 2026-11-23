# CEO Command Center

One morning view of every company you own. A multi-tenant SaaS for founders, holding companies and family offices that run several legal entities on different software.

**What it does**

- **Portfolio view:** reported cash, MRR, deadlines and health for every business side by side, with a page per business.
- **Connections:** read-only links to **Stripe** (MRR, active subscriptions, cancellations, 30-day net volume, balance) and to **your own Supabase apps** through a small snapshot contract (any metrics plus deadlines).
- **Deadlines:** filings, investor and grant reports, and renewals, entered by hand or synced from your apps, with owners.
- **AI briefing:** a daily summary written by Claude from the synced data only. Every item cites its source, and you can ask follow-up questions. It advises and never executes anything.
- **SaaS plumbing:** Clerk Organizations as tenants, admin/member roles, a 14-day trial, Stripe Checkout and Customer Portal, plan entity limits, and an audit log.

Entities stay separate: every record carries `workspace_id` and `entity_id`, and the app does not merge ledgers.

## Stack

Next.js 15 (App Router, server actions) · TypeScript · Tailwind · Clerk (Core 3) · Postgres on Supabase via Drizzle ORM · Stripe · Anthropic API · Vercel (cron)

## Setup

1. **Install:** `npm install`
2. **Environment:** copy `.env.example` to `.env.local` and fill it in.
   - **Clerk:** create an app and **enable Organizations**. In Organization settings, turn off personal accounts if you like; the app requires an org.
   - **Supabase:** create a project (for example `ceo-command-center` under the Venture Collective Group org). Use the **Transaction pooler** connection string as `DATABASE_URL`.
   - `CREDENTIALS_ENCRYPTION_KEY`: run `openssl rand -base64 32`. Keep it safe; rotating it breaks the stored connection secrets.
   - **Stripe (platform billing):** create three recurring prices (Starter, Professional, Executive) and paste their IDs. Add a webhook to `https://YOUR_DOMAIN/api/stripe/webhook` for `checkout.session.completed` and `customer.subscription.created|updated|deleted`. Enable the Customer Portal.
   - `ANTHROPIC_API_KEY` and, optionally, `ANTHROPIC_MODEL` (defaults to `claude-sonnet-5-5`).
   - `CRON_SECRET`: any long random string. Vercel sends it to `/api/cron/sync` daily at 10:00 UTC (see `vercel.json`).
3. **Database:** `npm run db:migrate`. This creates the tables and enables row-level security with no policies, so Supabase's public REST API can't reach them. The app connects as the database owner.
4. **Run:** `npm run dev`, then sign up, create a workspace and add a business.

## Connecting your own Supabase apps

Each app (FundOS, NonprofitOS, Grant Scout Pro, CRM OS, …) exposes one function, `command_center_snapshot(p_token, p_entity)`. The command center calls it with the app's **anon key** and a **per-connection token**, so no service-role key leaves the app.

1. Open `docs/supabase-app-contract.sql`, fill in the two `EDIT` sections with queries against that app's tables, and run it in the app's SQL editor.
2. Store a token hash in the app, as described in the file's header.
3. In the command center, go to **Connections → My Supabase app** and paste the project URL, anon key and token. Use **Entity reference** if one app holds several entities (for example, FundOS with more than one fund).

The standard metric keys `cash`, `monthly_burn`, `runway_months`, `mrr` and `active_customers` feed the portfolio totals and health checks. Runway is derived when an app reports `cash` and `monthly_burn`. Any other key appears on the business page.

## Stripe connector notes

Use a **restricted key** with read access to Balance, Balance transactions and Subscriptions only. MRR is computed from active USD subscriptions at list price and doesn't subtract coupons, so it can read higher than Stripe's own MRR chart when discounts apply. The connector pages through up to 5,000 objects per list.

## Project layout

```
src/
  app/
    page.tsx                 landing and pricing
    onboarding/              create or choose a workspace (Clerk org)
    app/                     authenticated app
      actions.ts             all server actions (tenant-scoped, audited)
      page.tsx               portfolio
      entities/[id]/         business page
      obligations/ connections/ settings/billing/ settings/team/ audit/
    api/stripe/webhook/      subscription sync
    api/cron/sync/           daily sync and briefing
  db/schema.ts               Drizzle schema
  lib/
    tenant.ts                Clerk org → workspace, roles, audit
    connectors/              stripe.ts, supabase-app.ts
    sync.ts portfolio.ts ai.ts billing.ts plans.ts crypto.ts
drizzle/                     SQL migrations
docs/supabase-app-contract.sql
```

## Roadmap

- QuickBooks and Plaid connectors for real bank cash
- Weekly and monthly reports by email
- Cross-entity comparisons and cash-flow forecasting
- Approval workflows for selected actions
- Mobile layout for briefings and approvals
