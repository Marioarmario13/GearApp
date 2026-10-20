"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { FormMessage, SubmitButton, TextAreaField } from "@/components/form";
import type { FormState } from "@/lib/forms";

/** Confirmar/desistir de presença. */
export function RsvpButton({
  going,
  signedIn,
  disabledReason,
  eventId,
  rsvp,
  leave,
}: {
  going: boolean;
  signedIn: boolean;
  disabledReason: string | null;
  eventId: string;
  rsvp: () => Promise<FormState>;
  leave: () => Promise<FormState>;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<FormState>({});

  if (!signedIn) {
    return (
      <Link
        href={`/entrar?next=/eventos/${eventId}`}
        className="self-start rounded-lg bg-accent px-4 py-2.5 font-semibold text-white hover:opacity-90"
      >
        Entre para confirmar presença
      </Link>
    );
  }
  if (disabledReason && !going) return <p className="text-sm text-muted">{disabledReason}</p>;

  return (
    <div className="flex flex-col gap-2">
      <FormMessage error={msg.error} success={msg.success} />
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setMsg(await (going ? leave() : rsvp())))}
        className={`self-start rounded-lg px-4 py-2.5 font-semibold disabled:opacity-60 ${
          going ? "border border-line" : "bg-accent text-white hover:opacity-90"
        }`}
      >
        {pending ? "Salvando…" : going ? "Cancelar minha presença" : "Confirmar presença"}
      </button>
    </div>
  );
}

/** Formulário com motivo (cancelar pelo organizador / remover pelo admin). */
export function ReasonForm({
  action,
  label,
  pendingLabel,
  noteLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  label: string;
  pendingLabel: string;
  noteLabel: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormMessage error={state.error} success={state.success} />
      <TextAreaField label={noteLabel} name="note" rows={2} maxLength={500} />
      <div>
        <SubmitButton pendingText={pendingLabel} variant="danger">
          {label}
        </SubmitButton>
      </div>
    </form>
  );
}
