"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import clsx from "clsx";
import type { ActionState } from "@/app/app/actions";

export function SubmitButton({
  children,
  pending,
  variant = "primary",
}: {
  children: React.ReactNode;
  pending?: string;
  variant?: "primary" | "default" | "ghost";
}) {
  const { pending: isPending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={isPending}
      className={variant === "primary" ? "btn-primary" : variant === "ghost" ? "btn-ghost" : "btn"}
    >
      {isPending ? pending ?? "Working…" : children}
    </button>
  );
}

export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnSuccess && state?.ok) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={clsx("space-y-4", className)}>
      {children}
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-700">{state.ok}</p>}
      {state?.answer && (
        <div className="whitespace-pre-wrap rounded-lg bg-stone-50 p-3 text-sm leading-relaxed">{state.answer}</div>
      )}
    </form>
  );
}
