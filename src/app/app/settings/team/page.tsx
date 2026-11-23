import { OrganizationProfile } from "@clerk/nextjs";
import { PageHeader } from "@/components/ui";

export default function TeamPage() {
  return (
    <>
      <PageHeader title="Team" sub="Invite executives and staff. Admins manage businesses, connections and billing; members can view and track deadlines." />
      <OrganizationProfile routing="hash" />
    </>
  );
}
