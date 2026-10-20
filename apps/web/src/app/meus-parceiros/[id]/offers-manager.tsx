"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton, TextAreaField } from "@/components/form";
import type { FormState } from "@/lib/forms";

/** Criar oferta (dono de parceiro verificado). */
export function OfferForm({
  action,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const e = state.fieldErrors ?? {};
  const v = state.values ?? {};
  return (
    <form
      key={state.success ?? JSON.stringify(v)}
      action={formAction}
      className="flex flex-col gap-3"
      noValidate
    >
      <FormMessage error={state.error} success={state.success} />
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
        <Field label="Título" name="title" required defaultValue={v.title} errors={e.title} />
        <Field
          label="Desconto"
          name="discountLabel"
          required
          placeholder="10% OFF"
          defaultValue={v.discountLabel}
          errors={e.discountLabel}
        />
      </div>
      <TextAreaField
        label="Descrição (opcional)"
        name="description"
        rows={2}
        maxLength={1000}
        defaultValue={v.description}
        errors={e.description}
      />
      <TextAreaField
        label="Regras (opcional)"
        name="terms"
        rows={2}
        maxLength={1000}
        defaultValue={v.terms}
        errors={e.terms}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          label="Válida até"
          name="endsOn"
          type="date"
          required
          defaultValue={v.endsOn}
          errors={e.endsOn}
        />
        <Field
          label="Total de cupons (opcional)"
          name="maxRedemptions"
          type="number"
          min={1}
          defaultValue={v.maxRedemptions}
          errors={e.maxRedemptions}
        />
        <Field
          label="Por pessoa"
          name="perUserLimit"
          type="number"
          min={1}
          max={10}
          defaultValue={v.perUserLimit ?? "1"}
          errors={e.perUserLimit}
        />
      </div>
      <div>
        <SubmitButton pendingText="Publicando…">Publicar oferta</SubmitButton>
      </div>
    </form>
  );
}

/** Validar cupom no balcão. */
export function RedeemForm({
  action,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormMessage error={state.error} success={state.success} />
      <div className="flex flex-wrap items-end gap-3">
        <Field
          label="Código do cupom"
          name="code"
          autoComplete="off"
          autoCapitalize="characters"
          placeholder="ABCD-2345"
          defaultValue={state.error ? state.values?.code : ""}
          errors={state.fieldErrors?.code}
        />
        <SubmitButton pendingText="Validando…">Validar cupom</SubmitButton>
      </div>
    </form>
  );
}
