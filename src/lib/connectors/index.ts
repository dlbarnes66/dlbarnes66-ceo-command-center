import "server-only";
import { stripeConnector } from "./stripe";
import { supabaseAppConnector } from "./supabase-app";
import type { Connector } from "./types";

export const connectors: Record<"stripe" | "supabase_app", Connector> = {
  stripe: stripeConnector,
  supabase_app: supabaseAppConnector,
};

export * from "./types";
