"use client";

import { ActionForm, SubmitButton } from "./forms";
import { createObligation } from "@/app/app/actions";
import { CATEGORY_LABEL } from "./ui";

export function ObligationForm({
  entities,
  fixedEntityId,
}: {
  entities: { id: string; name: string }[];
  fixedEntityId?: string;
}) {
  return (
    <ActionForm action={createObligation} resetOnSuccess>
      <div className="grid gap-3 sm:grid-cols-2">
        {fixedEntityId ? (
          <input type="hidden" name="entityId" value={fixedEntityId} />
        ) : (
          <div>
            <label className="label" htmlFor="ob-entity">Business</label>
            <select id="ob-entity" name="entityId" className="input" required>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className={fixedEntityId ? "sm:col-span-2" : ""}>
          <label className="label" htmlFor="ob-title">What&apos;s due</label>
          <input id="ob-title" name="title" className="input" required placeholder="Form 990 filing" />
        </div>
        <div>
          <label className="label" htmlFor="ob-due">Due date</label>
          <input id="ob-due" name="dueDate" type="date" className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="ob-cat">Category</label>
          <select id="ob-cat" name="category" className="input" defaultValue="compliance">
            {Object.entries(CATEGORY_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="ob-owner">Owner (optional)</label>
          <input id="ob-owner" name="ownerName" className="input" placeholder="CFO" />
        </div>
      </div>
      <SubmitButton pending="Adding…">Add deadline</SubmitButton>
    </ActionForm>
  );
}
