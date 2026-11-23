"use client";

import { Sparkles } from "lucide-react";
import type { BriefingItem } from "@/db/schema";
import { ActionForm, SubmitButton } from "./forms";
import { askAction, generateBriefingAction } from "@/app/app/actions";

const DOT = { info: "bg-sky-500", attention: "bg-amber-500", urgent: "bg-red-600" } as const;

export function BriefingPanel({
  briefing,
}: {
  briefing: { summary: string; items: BriefingItem[]; createdAt: string; model: string } | null;
}) {
  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles size={18} aria-hidden className="text-ink-soft" />
          <h2 className="h2">Briefing</h2>
          {briefing && (
            <span className="text-xs text-ink-muted">
              {new Date(briefing.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
            </span>
          )}
        </div>
        <ActionForm action={generateBriefingAction} className="!space-y-1 text-right">
          <SubmitButton variant="default" pending="Writing…">
            {briefing ? "Refresh" : "Generate briefing"}
          </SubmitButton>
        </ActionForm>
      </div>

      {briefing ? (
        <div className="space-y-4">
          <p className="text-sm font-medium leading-relaxed">{briefing.summary}</p>
          <ul className="space-y-3">
            {briefing.items.map((item, i) => (
              <li key={i} className="flex gap-3">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[item.severity]}`} aria-hidden />
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {item.heading}
                    {item.entityName && <span className="ml-2 text-xs font-normal text-ink-muted">{item.entityName}</span>}
                  </div>
                  <p className="text-sm leading-relaxed text-ink-soft">{item.body}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">Source: {item.sources.join(", ")}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="muted">
          Generate a briefing to get a summary of what changed and what needs your decision. It runs automatically
          every morning too.
        </p>
      )}

      <div className="mt-5 border-t border-line pt-4">
        <ActionForm action={askAction} className="space-y-3">
          <div className="flex gap-2">
            <input name="question" className="input" placeholder="Which business needs me most this week?" />
            <SubmitButton variant="default" pending="Thinking…">Ask</SubmitButton>
          </div>
        </ActionForm>
      </div>
    </section>
  );
}
