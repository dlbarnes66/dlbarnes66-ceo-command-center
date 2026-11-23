export type MetricUnit = "usd" | "count" | "percent" | "months";

export type ConnectorMetric = {
  key: string;
  label: string;
  value: number;
  unit: MetricUnit;
};

export type ConnectorObligation = {
  externalId: string;
  title: string;
  category: "compliance" | "tax" | "investor" | "grant" | "legal" | "finance" | "operations" | "other";
  dueDate: string; // YYYY-MM-DD
  status: "open" | "done";
  ownerName?: string | null;
};

export type ConnectorResult = {
  metrics: ConnectorMetric[];
  obligations: ConnectorObligation[];
};

export type ConnectorInput = {
  secret: string;
  config: Record<string, string>;
};

export interface Connector {
  provider: "stripe" | "supabase_app";
  /** Human-readable name of where the numbers come from, shown as a citation. */
  sourceName(config: Record<string, string>): string;
  /** Cheap credential check used when a connection is created. */
  test(input: ConnectorInput): Promise<void>;
  fetch(input: ConnectorInput): Promise<ConnectorResult>;
}

/** Standard metric keys the portfolio view understands. Apps may send others too. */
export const STANDARD_KEYS = {
  cash: "cash",
  monthlyBurn: "monthly_burn",
  runway: "runway_months",
  mrr: "mrr",
  activeCustomers: "active_customers",
  cancellations7d: "cancellations_7d",
  netVolume30d: "net_volume_30d",
  stripeBalance: "stripe_balance",
} as const;
