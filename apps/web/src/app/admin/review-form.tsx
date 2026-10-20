"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton, TextAreaField } from "@/components/form";
import type { FormState } from "@/lib/forms";

export interface Decision {
  value: string;
  label: string;
  pendingLabel: string;
  variant: "primary" | "secondary" | "danger";
}

/** Formulário de revisão: nota opcional (obrigatória ao recusar/suspender) + botões de decisão. */
export function ReviewForm({
  action,
  decisions,
  noteLabel = "Observação (obrigatória para recusar)",
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  decisions: Decision[];
  noteLabel?: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormMessage error={state.error} success={state.success} />
      <TextAreaField label={noteLabel} name="note" rows={2} maxLength={500} />
      <div className="flex flex-wrap gap-2">
        {decisions.map((d) => (
          <SubmitButton
            key={d.value}
            name="decision"
            value={d.value}
            variant={d.variant}
            pendingText={d.pendingLabel}
          >
            {d.label}
          </SubmitButton>
        ))}
      </div>
    </form>
  );
}
