"use client";

import { ActionForm, SubmitButton } from "./forms";
import { createEntity, updateEntity } from "@/app/app/actions";
import { KIND_LABEL } from "./ui";

type Initial = {
  id: string;
  name: string;
  legalName: string | null;
  kind: string;
  jurisdiction: string | null;
  description: string | null;
};

export function EntityForm({ initial }: { initial?: Initial }) {
  return (
    <ActionForm action={initial ? updateEntity : createEntity}>
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input id="name" name="name" className="input" required defaultValue={initial?.name} placeholder="Grant Scout Pro" />
        </div>
        <div>
          <label className="label" htmlFor="kind">Type</label>
          <select id="kind" name="kind" className="input" defaultValue={initial?.kind ?? "operating"}>
            {Object.entries(KIND_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="legalName">Legal name</label>
          <input id="legalName" name="legalName" className="input" defaultValue={initial?.legalName ?? ""} placeholder="Grant Scout Pro LLC" />
        </div>
        <div>
          <label className="label" htmlFor="jurisdiction">Jurisdiction</label>
          <input id="jurisdiction" name="jurisdiction" className="input" defaultValue={initial?.jurisdiction ?? ""} placeholder="Delaware" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="description">What it does</label>
        <textarea id="description" name="description" rows={2} className="input" defaultValue={initial?.description ?? ""} />
      </div>
      <SubmitButton pending="Saving…">{initial ? "Save changes" : "Add business"}</SubmitButton>
    </ActionForm>
  );
}
