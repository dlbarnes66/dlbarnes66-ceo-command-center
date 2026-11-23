import { getTenant } from "@/lib/tenant";
import { EntityForm } from "@/components/entity-form";
import { PageHeader } from "@/components/ui";

export default async function NewEntity() {
  const ctx = await getTenant();
  return (
    <>
      <PageHeader title="Add a business" sub="Each business is its own legal entity with separate records." />
      <div className="card max-w-2xl p-6">
        {ctx.isAdmin ? <EntityForm /> : <p className="muted">Only workspace admins can add businesses.</p>}
      </div>
    </>
  );
}
