import { RefreshCw, Trash2 } from "lucide-react";
import type { Connection } from "@/db/schema";
import { relativeTime } from "@/lib/format";
import { deleteConnection, syncConnectionAction } from "@/app/app/actions";
import { Badge } from "./ui";

export function ConnectionRow({ c, entityName, canManage }: { c: Connection; entityName?: string; canManage: boolean }) {
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-medium">
          {c.label}
          <Badge tone={c.status === "connected" ? "success" : c.status === "error" ? "danger" : "neutral"}>
            {c.status === "connected" ? "Connected" : c.status === "error" ? "Error" : "Pending"}
          </Badge>
        </div>
        <div className="text-xs text-ink-muted">
          {entityName ? `${entityName} · ` : ""}
          {c.provider === "stripe" ? "Stripe" : `Supabase app · ${c.config.url ?? ""}`} · synced {relativeTime(c.lastSyncedAt)}
        </div>
        {c.lastError && <div className="mt-1 text-xs text-red-700">{c.lastError}</div>}
      </div>
      <form action={syncConnectionAction}>
        <input type="hidden" name="id" value={c.id} />
        <button className="btn"><RefreshCw size={14} aria-hidden /> Sync</button>
      </form>
      {canManage && (
        <form action={deleteConnection}>
          <input type="hidden" name="id" value={c.id} />
          <button className="btn-ghost" aria-label={`Remove ${c.label}`} title="Remove"><Trash2 size={15} /></button>
        </form>
      )}
    </li>
  );
}
