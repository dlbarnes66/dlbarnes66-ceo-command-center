export function formatValue(value: number, unit: string): string {
  switch (unit) {
    case "usd":
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: Math.abs(value) >= 100_000 ? "compact" : "standard",
        maximumFractionDigits: Math.abs(value) >= 100_000 ? 2 : 0,
      }).format(value);
    case "percent":
      return `${value.toFixed(1)}%`;
    case "months":
      return `${value.toFixed(1)} mo`;
    default:
      return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
  }
}

export function formatDelta(current: number, previous: number | undefined): { text: string; tone: "up" | "down" | "flat" } | null {
  if (previous === undefined || previous === 0) return null;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(pct) < 0.05) return { text: "0%", tone: "flat" };
  return { text: `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`, tone: pct > 0 ? "up" : "down" };
}

export function relativeTime(date: Date | null | undefined): string {
  if (!date) return "never";
  const s = Math.round((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function daysUntil(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${isoDate}T00:00:00`);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

export function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
