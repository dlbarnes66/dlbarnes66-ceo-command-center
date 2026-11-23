import { NextResponse } from "next/server";
import { db } from "@/db";
import { syncWorkspace } from "@/lib/sync";
import { generateBriefing } from "@/lib/ai";
import { hasAccess } from "@/lib/plans";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Daily: sync every active workspace, then write its morning briefing. */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaces = (await db.query.workspaces.findMany()).filter(hasAccess);
  const report: { workspaceId: string; synced: number; failed: number; briefing: boolean }[] = [];

  for (const ws of workspaces) {
    const results = await syncWorkspace(ws.id);
    let briefing = false;
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        await generateBriefing(ws.id, null);
        briefing = true;
      } catch {
        /* no entities yet, or model error: skip this workspace */
      }
    }
    report.push({
      workspaceId: ws.id,
      synced: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      briefing,
    });
  }

  return NextResponse.json({ workspaces: report.length, report });
}
