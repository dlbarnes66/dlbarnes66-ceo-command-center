import Link from "next/link";
import { Show } from "@clerk/nextjs";
import { PLANS, SELF_SERVE_PLANS } from "@/lib/plans";

const FEATURES = [
  ["Every company, one view", "Cash, revenue, runway and deadlines for each business side by side, with each entity's records kept separate."],
  ["Connect what you already use", "Pull live numbers from Stripe and your own Supabase apps. Read-only by design."],
  ["A briefing every morning", "An AI assistant tells you what changed and what needs a decision, and cites the source for every number."],
  ["Never miss a deadline", "Filings, investor reports and grant reports for every entity, tracked in one list with owners."],
];

export default function Home() {
  return (
    <main>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="font-semibold">CEO Command Center</span>
        <nav className="flex items-center gap-2">
          <Show when="signed-out">
            <Link href="/sign-in" className="btn-ghost">Sign in</Link>
            <Link href="/sign-up" className="btn-primary">Start free trial</Link>
          </Show>
          <Show when="signed-in">
            <Link href="/app" className="btn-primary">Open dashboard</Link>
          </Show>
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-6 pb-16 pt-20 text-center">
        <h1 className="text-5xl font-semibold tracking-tight">One morning view of every company you own.</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-soft">
          For founders, holding companies and family offices running several businesses on different software. See
          cash, revenue, runway and deadlines across the portfolio in ten minutes, without logging into ten apps.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/sign-up" className="btn-primary px-5 py-2.5 text-base">Start your 14-day trial</Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-20 sm:grid-cols-2">
        {FEATURES.map(([title, body]) => (
          <div key={title} className="card p-6">
            <div className="h2">{title}</div>
            <p className="muted mt-2">{body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="mb-6 text-center text-2xl font-semibold">Pricing</h2>
        <div className="grid gap-4 sm:grid-cols-4">
          {[...SELF_SERVE_PLANS, "enterprise" as const].map((id) => (
            <div key={id} className="card p-6">
              <div className="h2">{PLANS[id].name}</div>
              <div className="mt-2 text-2xl font-semibold">{PLANS[id].priceLabel}</div>
              <p className="muted mt-1">{PLANS[id].blurb}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
