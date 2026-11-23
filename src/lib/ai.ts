import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { db, schema } from "@/db";
import { formatValue } from "./format";
import { loadPortfolio, type Portfolio } from "./portfolio";

const MODEL = () => process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic();
}

const SYSTEM = `You are the executive assistant inside a CEO command center that oversees several separate legal entities.
Rules:
- Use ONLY the portfolio data provided. Never invent numbers, dates, names or causes.
- Every claim must cite the source(s) given in the data, e.g. "Stripe (Grant Scout Pro)" or "Manual entry".
- Keep entities separate. Never imply that one entity's cash or obligations belong to another.
- You advise; you never execute. Do not tell the CEO an action was taken.
- If data is missing or stale, say so plainly instead of guessing.
- Be brief and specific. Lead with what needs a decision.`;

/** Compact, citation-ready text rendering of the portfolio for the model. */
export function portfolioContext(p: Portfolio): string {
  const today = new Date().toISOString().slice(0, 10);
  const lines: string[] = [`Today: ${today}`, ""];
  for (const v of p.entities) {
    lines.push(`## ${v.entity.name} (${v.entity.kind}${v.entity.jurisdiction ? `, ${v.entity.jurisdiction}` : ""})`);
    lines.push(`Health: ${v.health}${v.flags.length ? ` — ${v.flags.join("; ")}` : ""}`);
    for (const c of v.connections) {
      lines.push(`Connection: ${c.label} [${c.provider}] status=${c.status} last_synced=${c.lastSyncedAt?.toISOString() ?? "never"}`);
    }
    for (const m of v.metrics) {
      const prev = m.previous !== undefined ? ` (previous ${formatValue(m.previous, m.unit)})` : "";
      lines.push(`- ${m.label}: ${formatValue(m.value, m.unit)}${prev} — source: ${m.source}, as of ${m.capturedAt.toISOString()}`);
    }
    if (!v.metrics.length) lines.push("- No metrics synced yet.");
    lines.push("");
  }
  lines.push("## Open obligations (next 60 days, including overdue)");
  for (const o of p.upcoming) {
    lines.push(`- [${o.entityName}] ${o.title} — due ${o.dueDate}, ${o.category}${o.ownerName ? `, owner ${o.ownerName}` : ""} — source: ${o.source}`);
  }
  if (!p.upcoming.length) lines.push("- None recorded.");
  return lines.join("\n");
}

const briefingSchema = z.object({
  summary: z.string(),
  items: z
    .array(
      z.object({
        heading: z.string(),
        body: z.string(),
        severity: z.enum(["info", "attention", "urgent"]),
        entityName: z.string().optional(),
        sources: z.array(z.string()).min(1),
      }),
    )
    .max(8),
});

const BRIEFING_TOOL: Anthropic.Tool = {
  name: "publish_briefing",
  description: "Publish the CEO's portfolio briefing.",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "One or two sentences: the single most important thing today." },
      items: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          properties: {
            heading: { type: "string" },
            body: { type: "string", description: "One to three sentences, specific, with numbers from the data." },
            severity: { type: "string", enum: ["info", "attention", "urgent"] },
            entityName: { type: "string" },
            sources: { type: "array", items: { type: "string" }, minItems: 1 },
          },
          required: ["heading", "body", "severity", "sources"],
        },
      },
    },
    required: ["summary", "items"],
  },
};

export async function generateBriefing(workspaceId: string, createdBy: string | null) {
  const portfolio = await loadPortfolio(workspaceId);
  if (!portfolio.entities.length) throw new Error("Add a business before generating a briefing.");

  const res = await anthropic().messages.create({
    model: MODEL(),
    max_tokens: 2000,
    system: SYSTEM,
    tools: [BRIEFING_TOOL],
    tool_choice: { type: "tool", name: BRIEFING_TOOL.name },
    messages: [
      {
        role: "user",
        content: `Write today's portfolio briefing. Order items by urgency: overdue obligations, runway or cash risk, revenue changes, upcoming deadlines, data gaps.\n\n<portfolio>\n${portfolioContext(portfolio)}\n</portfolio>`,
      },
    ],
  });

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("The assistant didn't return a briefing.");
  const parsed = briefingSchema.parse(block.input);

  const [row] = await db
    .insert(schema.briefings)
    .values({ workspaceId, summary: parsed.summary, items: parsed.items, model: MODEL(), createdBy })
    .returning();
  return row;
}

export async function askPortfolio(workspaceId: string, question: string): Promise<string> {
  const portfolio = await loadPortfolio(workspaceId);
  const res = await anthropic().messages.create({
    model: MODEL(),
    max_tokens: 1200,
    system: `${SYSTEM}\n- Answer in plain prose, under 200 words. Put sources in parentheses after each claim.`,
    messages: [
      {
        role: "user",
        content: `<portfolio>\n${portfolioContext(portfolio)}\n</portfolio>\n\nQuestion: ${question}`,
      },
    ],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
