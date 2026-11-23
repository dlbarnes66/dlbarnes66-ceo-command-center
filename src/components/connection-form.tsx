"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "./forms";
import { createConnection } from "@/app/app/actions";

export function ConnectionForm({
  entities,
  fixedEntityId,
}: {
  entities: { id: string; name: string }[];
  fixedEntityId?: string;
}) {
  const [provider, setProvider] = useState<"stripe" | "supabase_app">("stripe");

  return (
    <ActionForm action={createConnection} resetOnSuccess>
      <div className="grid gap-4 sm:grid-cols-2">
        {fixedEntityId ? (
          <input type="hidden" name="entityId" value={fixedEntityId} />
        ) : (
          <div>
            <label className="label" htmlFor="entityId">Business</label>
            <select id="entityId" name="entityId" className="input" required>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="label" htmlFor="provider">Source</label>
          <select
            id="provider"
            name="provider"
            className="input"
            value={provider}
            onChange={(e) => setProvider(e.target.value as "stripe" | "supabase_app")}
          >
            <option value="stripe">Stripe</option>
            <option value="supabase_app">My Supabase app</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="label">Label</label>
          <input
            id="label"
            name="label"
            className="input"
            required
            placeholder={provider === "stripe" ? "Stripe" : "FundOS"}
            defaultValue={provider === "stripe" ? "Stripe" : ""}
            key={provider}
          />
        </div>
      </div>

      {provider === "stripe" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="apiKey">Restricted API key</label>
            <input id="apiKey" name="apiKey" className="input font-mono" required placeholder="rk_live_…" autoComplete="off" />
            <p className="hint">
              In Stripe, go to Developers → API keys → Create restricted key. Give it read access to Balance,
              Balance transactions and Subscriptions, and nothing else. The key is encrypted at rest.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="accountName">Account name (optional)</label>
            <input id="accountName" name="accountName" className="input" placeholder="Grant Scout Pro" />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="url">Project URL</label>
            <input id="url" name="url" className="input font-mono" required placeholder="https://abcd1234.supabase.co" />
          </div>
          <div>
            <label className="label" htmlFor="entityRef">Entity reference (optional)</label>
            <input id="entityRef" name="entityRef" className="input" placeholder="fund-i" />
            <p className="hint">Passed to the app if it holds several entities, like FundOS with more than one fund.</p>
          </div>
          <div>
            <label className="label" htmlFor="anonKey">Anon key</label>
            <input id="anonKey" name="anonKey" className="input font-mono" required autoComplete="off" />
          </div>
          <div>
            <label className="label" htmlFor="token">Connection token</label>
            <input id="token" name="token" className="input font-mono" required autoComplete="off" />
            <p className="hint">The token you stored in the app when you installed the snapshot function.</p>
          </div>
        </div>
      )}
      <SubmitButton pending="Testing connection…">Connect</SubmitButton>
    </ActionForm>
  );
}
