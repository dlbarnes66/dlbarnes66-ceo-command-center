import { Check, RotateCcw, Trash2 } from "lucide-react";
import { daysUntil, formatDate } from "@/lib/format";
import { toggleObligation, deleteObligation } from "@/app/app/actions";
import { Badge, CATEGORY_LABEL } from "./ui";

type Row = {
  id: string;
  title: string;
  dueDate: string;
  status: "open" | "done";
  category: string;
  ownerName: string | null;
  source: string;
  connectionId: string | null;
  entityName?: string;
};

export function ObligationList({ rows, showEntity = true, compact }: { rows: Row[]; showEntity?: boolean; compact?: boolean }) {
  if (!rows.length) return <p className="muted">Nothing due. Add deadlines so they show up here.</p>;
  return (
    <ul className="divide-y divide-line">
      {rows.map((o) => {
        const days = daysUntil(o.dueDate);
        const tone = o.status === "done" ? "neutral" : days < 0 ? "danger" : days <= 14 ? "warning" : "neutral";
        const when = o.status === "done" ? "Done" : days < 0 ? `${-days}d overdue` : days === 0 ? "Today" : `In ${days}d`;
        return (
          <li key={o.id} className="flex items-center gap-3 py-2.5">
            <form action={toggleObligation}>
              <input type="hidden" name="id" value={o.id} />
              <button
                className="btn-ghost !p-1"
                aria-label={o.status === "open" ? `Mark ${o.title} done` : `Reopen ${o.title}`}
                title={o.status === "open" ? "Mark done" : "Reopen"}
              >
                {o.status === "open" ? <Check size={16} /> : <RotateCcw size={16} />}
              </button>
            </form>
            <div className="min-w-0 flex-1">
              <div className={`truncate text-sm ${o.status === "done" ? "text-ink-muted line-through" : "font-medium"}`}>
                {o.title}
              </div>
              <div className="truncate text-xs text-ink-muted">
                {showEntity && o.entityName ? `${o.entityName} · ` : ""}
                {CATEGORY_LABEL[o.category]}
                {o.ownerName ? ` · ${o.ownerName}` : ""}
                {!compact ? ` · ${o.source}` : ""}
              </div>
            </div>
            <div className="text-right">
              <Badge tone={tone}>{when}</Badge>
              {!compact && <div className="mt-0.5 text-xs text-ink-muted">{formatDate(o.dueDate)}</div>}
            </div>
            {!compact && !o.connectionId && (
              <form action={deleteObligation}>
                <input type="hidden" name="id" value={o.id} />
                <button className="btn-ghost !p-1" aria-label={`Delete ${o.title}`} title="Delete">
                  <Trash2 size={15} />
                </button>
              </form>
            )}
          </li>
        );
      })}
    </ul>
  );
}
