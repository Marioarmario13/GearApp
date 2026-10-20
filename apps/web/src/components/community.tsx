"use client";

import { REPORT_REASON_LABELS, REPORT_REASONS, type ReportTarget } from "@gearhead/shared";
import { useActionState, useState, useTransition } from "react";
import { reportAction } from "@/app/actions/community";
import type { FormState } from "@/lib/forms";
import { FormMessage, SelectField, SubmitButton, TextAreaField } from "./form";

const REASON_OPTIONS = REPORT_REASONS.map((r) => ({ value: r, label: REPORT_REASON_LABELS[r] }));

/** "Denunciar" recolhível, usado em perfis, veículos, parceiros, eventos e ofertas. */
export function ReportButton({
  targetType,
  targetId,
}: {
  targetType: ReportTarget;
  targetId: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(reportAction, {});
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted hover:underline">Denunciar</summary>
      {state.success ? (
        <FormMessage success={state.success} />
      ) : (
        <form
          action={formAction}
          className="mt-3 flex flex-col gap-3 rounded-xl border border-line p-4"
        >
          <FormMessage error={state.error} />
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="targetId" value={targetId} />
          <SelectField
            label="Motivo"
            name="reason"
            options={REASON_OPTIONS}
            placeholder="Escolha…"
            errors={state.fieldErrors?.reason}
          />
          <TextAreaField label="Detalhes (opcional)" name="details" rows={2} maxLength={1000} />
          <div>
            <SubmitButton pendingText="Enviando…" variant="secondary">
              Enviar denúncia
            </SubmitButton>
          </div>
        </form>
      )}
    </details>
  );
}

/** Botão que executa uma Server Action sem formulário (amizade, bloqueio…). */
export function ActionButton({
  action,
  label,
  pendingLabel,
  confirmText,
  variant = "secondary",
}: {
  action: () => Promise<FormState>;
  label: string;
  pendingLabel: string;
  confirmText?: string;
  variant?: "primary" | "secondary" | "danger";
}) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<FormState>({});
  const styles = {
    primary: "bg-accent text-white hover:opacity-90",
    secondary: "border border-line hover:bg-surface",
    danger: "text-red-600 hover:underline dark:text-red-400",
  }[variant];
  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirmText && !window.confirm(confirmText)) return;
          start(async () => setState(await action()));
        }}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-60 ${styles}`}
      >
        {pending ? pendingLabel : label}
      </button>
      {state.error && <span className="text-xs text-red-600 dark:text-red-400">{state.error}</span>}
    </span>
  );
}
