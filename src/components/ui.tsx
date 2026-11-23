import clsx from "clsx";

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  children: React.ReactNode;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        tone === "neutral" && "bg-stone-100 text-stone-700",
        tone === "success" && "bg-emerald-50 text-emerald-800",
        tone === "warning" && "bg-amber-50 text-amber-800",
        tone === "danger" && "bg-red-50 text-red-800",
        tone === "info" && "bg-sky-50 text-sky-800",
      )}
    >
      {children}
    </span>
  );
}

export const HEALTH = {
  healthy: { label: "Healthy", tone: "success" },
  attention: { label: "Needs attention", tone: "warning" },
  urgent: { label: "Urgent", tone: "danger" },
  no_data: { label: "No data yet", tone: "neutral" },
} as const;

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-stone-100/70 p-4">
      <div className="text-sm text-ink-soft">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-muted">{sub}</div>}
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="h1">{title}</h1>
        {sub && <p className="muted mt-1">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <div className="h2">{title}</div>
      <p className="muted mt-1 max-w-md">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export const KIND_LABEL: Record<string, string> = {
  fund: "Investment fund",
  nonprofit: "Nonprofit",
  saas: "SaaS",
  real_estate: "Real estate",
  operating: "Operating company",
  holding: "Holding company",
  other: "Other",
};

export const CATEGORY_LABEL: Record<string, string> = {
  compliance: "Compliance",
  tax: "Tax",
  investor: "Investor",
  grant: "Grant",
  legal: "Legal",
  finance: "Finance",
  operations: "Operations",
  other: "Other",
};
