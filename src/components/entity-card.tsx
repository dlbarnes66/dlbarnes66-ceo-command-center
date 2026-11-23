import Link from "next/link";
import { Plug, PlugZap } from "lucide-react";
import type { EntityView } from "@/lib/portfolio";
import { formatDelta, formatValue, relativeTime } from "@/lib/format";
import { Badge, HEALTH, KIND_LABEL } from "./ui";

export function EntityCard({ view }: { view: EntityView }) {
  const h = HEALTH[view.health];
  const top = view.metrics.slice(0, 4);
  const lastSync = view.connections
    .map((c) => c.lastSyncedAt)
    .filter((d): d is Date => !!d)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const hasError = view.connections.some((c) => c.status === "error");

  return (
    <Link href={`/app/entities/${view.entity.id}`} className="card block p-5 transition hover:border-stone-300">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold">{view.entity.name}</div>
          <div className="text-xs text-ink-muted">{KIND_LABEL[view.entity.kind]}</div>
        </div>
        <Badge tone={h.tone}>{h.label}</Badge>
      </div>

      {top.length > 0 ? (
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
          {top.map((m) => {
            const d = formatDelta(m.value, m.previous);
            return (
              <div key={m.key}>
                <dt className="text-xs text-ink-muted">{m.label}</dt>
                <dd className="text-sm font-medium">
                  {formatValue(m.value, m.unit)}
                  {d && (
                    <span className={d.tone === "up" ? "ml-1.5 text-xs text-emerald-700" : d.tone === "down" ? "ml-1.5 text-xs text-red-700" : "ml-1.5 text-xs text-ink-muted"}>
                      {d.text}
                    </span>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      ) : (
        <p className="muted mt-4">No numbers yet. Connect Stripe or one of your apps.</p>
      )}

      {view.flags.length > 0 && <p className="mt-3 text-xs text-amber-800">{view.flags.join(" · ")}</p>}

      <div className="mt-4 flex items-center gap-1.5 border-t border-line pt-3 text-xs text-ink-muted">
        {hasError ? <PlugZap size={14} className="text-red-600" aria-hidden /> : <Plug size={14} aria-hidden />}
        {view.connections.length
          ? `${view.connections.map((c) => c.label).join(", ")} · synced ${relativeTime(lastSync)}`
          : "No connections"}
      </div>
    </Link>
  );
}
