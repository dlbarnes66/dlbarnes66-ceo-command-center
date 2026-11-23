import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Connector, ConnectorInput, ConnectorResult } from "./types";

/**
 * Connects to one of your own Supabase-backed apps (FundOS, NonprofitOS, Grant
 * Scout Pro, …). The app exposes a single Postgres function,
 * command_center_snapshot(p_token text, p_entity text), defined in
 * docs/supabase-app-contract.sql. We call it with the app's anon key plus a
 * per-connection token, so no service-role key ever leaves the app.
 *
 * secret  = JSON {"anonKey": "...", "token": "..."}
 * config  = { url, entityRef?, appName? }
 */
const secretSchema = z.object({ anonKey: z.string().min(20), token: z.string().min(16) });

const snapshotSchema = z.object({
  metrics: z
    .array(
      z.object({
        key: z.string().regex(/^[a-z0-9_]{1,64}$/),
        label: z.string().min(1).max(120),
        value: z.coerce.number().finite(),
        unit: z.enum(["usd", "count", "percent", "months"]),
      }),
    )
    .max(200)
    .default([]),
  obligations: z
    .array(
      z.object({
        id: z.coerce.string().min(1).max(200),
        title: z.string().min(1).max(300),
        category: z
          .enum(["compliance", "tax", "investor", "grant", "legal", "finance", "operations", "other"])
          .catch("other"),
        due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        status: z.enum(["open", "done"]).catch("open"),
        owner: z.string().max(200).nullish(),
      }),
    )
    .max(1000)
    .default([]),
});

function parseSecret(secret: string) {
  try {
    return secretSchema.parse(JSON.parse(secret));
  } catch {
    throw new Error("Supabase app credentials must include the anon key and connection token.");
  }
}

async function call({ secret, config }: ConnectorInput) {
  const url = config.url;
  if (!url || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) {
    throw new Error("Enter the project URL, like https://abcd1234.supabase.co");
  }
  const { anonKey, token } = parseSecret(secret);
  const supabase = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.rpc("command_center_snapshot", {
    p_token: token,
    p_entity: config.entityRef || null,
  });
  if (error) throw new Error(`App returned an error: ${error.message}`);
  const parsed = snapshotSchema.safeParse(data);
  if (!parsed.success) throw new Error("App response doesn't match the command center contract.");
  return parsed.data;
}

export const supabaseAppConnector: Connector = {
  provider: "supabase_app",
  sourceName: (config) => config.appName || "Supabase app",

  async test(input) {
    await call(input);
  },

  async fetch(input): Promise<ConnectorResult> {
    const data = await call(input);
    return {
      metrics: data.metrics,
      obligations: data.obligations.map((o) => ({
        externalId: o.id,
        title: o.title,
        category: o.category,
        dueDate: o.due_date,
        status: o.status,
        ownerName: o.owner ?? null,
      })),
    };
  },
};
