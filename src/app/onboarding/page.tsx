import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { CreateOrganization, OrganizationList } from "@clerk/nextjs";

export default async function Onboarding() {
  const { orgId } = await auth();
  if (orgId) redirect("/app");

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <h1 className="h1">Set up your workspace</h1>
        <p className="muted mt-2 max-w-lg">
          A workspace holds your whole portfolio, like your holding company or family office. You&apos;ll add each
          business inside it next. Invite your team from settings later.
        </p>
      </div>
      <OrganizationList
        hidePersonal
        afterSelectOrganizationUrl="/app"
        afterCreateOrganizationUrl="/app"
      />
      <details className="text-sm text-ink-soft">
        <summary className="cursor-pointer">Create a new workspace instead</summary>
        <div className="mt-4">
          <CreateOrganization afterCreateOrganizationUrl="/app" skipInvitationScreen />
        </div>
      </details>
    </main>
  );
}
