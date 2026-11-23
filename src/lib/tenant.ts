import "server-only";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { hasAccess } from "./plans";

export type TenantContext = {
  userId: string;
  orgId: string;
  isAdmin: boolean;
  workspace: schema.Workspace;
};

const TRIAL_DAYS = 14;

/**
 * Resolves the signed-in user's active Clerk Organization to a workspace row,
 * creating it (with a trial) on first visit. Every query in the app must be
 * scoped by ctx.workspace.id — this is the tenant boundary.
 */
export async function getTenant(opts: { requireAccess?: boolean } = {}): Promise<TenantContext> {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/onboarding");

  let workspace = await db.query.workspaces.findFirst({ where: eq(schema.workspaces.clerkOrgId, orgId) });
  if (!workspace) {
    const client = await clerkClient();
    const org = await client.organizations.getOrganization({ organizationId: orgId });
    const [created] = await db
      .insert(schema.workspaces)
      .values({
        clerkOrgId: orgId,
        name: org.name,
        plan: "trial",
        subscriptionStatus: "trialing",
        trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86_400_000),
      })
      .onConflictDoNothing({ target: schema.workspaces.clerkOrgId })
      .returning();
    workspace = created ?? (await db.query.workspaces.findFirst({ where: eq(schema.workspaces.clerkOrgId, orgId) }))!;
  }

  if (opts.requireAccess !== false && !hasAccess(workspace)) redirect("/app/settings/billing?expired=1");

  return { userId, orgId, isAdmin: orgRole === "org:admin", workspace };
}

export async function requireAdmin(): Promise<TenantContext> {
  const ctx = await getTenant();
  if (!ctx.isAdmin) throw new Error("Only workspace admins can do that.");
  return ctx;
}

export async function audit(
  ctx: TenantContext,
  action: string,
  target?: string,
  meta: Record<string, unknown> = {},
) {
  await db.insert(schema.auditLog).values({
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.userId,
    action,
    target,
    meta,
  });
}
