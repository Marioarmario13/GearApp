"use client";

import {
  BRAZIL_STATES,
  EVENT_KIND_HINTS,
  EVENT_KIND_LABELS,
  EVENT_KINDS,
  toLocalInputValue,
  type EventKind,
  type GearEvent,
} from "@gearhead/shared";
import { useActionState, useState } from "react";
import { Field, FormMessage, SelectField, SubmitButton, TextAreaField } from "@/components/form";
import type { FormState } from "@/lib/forms";

const KIND_OPTIONS = EVENT_KINDS.map((k) => ({ value: k, label: EVENT_KIND_LABELS[k] }));
const STATE_OPTIONS = BRAZIL_STATES.map((uf) => ({ value: uf, label: uf }));

export function EventForm({
  action,
  event,
  hostOptions,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  event?: GearEvent;
  /** Parceiros verificados do usuário que podem ser anfitriões. */
  hostOptions: { value: string; label: string }[];
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const e = state.fieldErrors ?? {};
  const v = state.values ?? {
    kind: event?.kind ?? "",
    title: event?.title ?? "",
    description: event?.description ?? "",
    startsAt: event ? toLocalInputValue(event.starts_at) : "",
    endsAt: event ? toLocalInputValue(event.ends_at) : "",
    venueName: event?.venue_name ?? "",
    street: event?.street ?? "",
    streetNumber: event?.street_number ?? "",
    district: event?.district ?? "",
    city: event?.city ?? "",
    state: event?.state ?? "",
    capacity: event?.capacity ? String(event.capacity) : "",
    businessId: event?.business_id ?? "",
  };
  const [kind, setKind] = useState(v.kind);
  const hint = EVENT_KIND_HINTS[kind as EventKind];

  return (
    <form key={JSON.stringify(v)} action={formAction} className="flex flex-col gap-4" noValidate>
      <FormMessage error={state.error} success={state.success} />
      <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
        <Field label="Título" name="title" required defaultValue={v.title} errors={e.title} />
        <SelectField
          label="Tipo"
          name="kind"
          options={KIND_OPTIONS}
          placeholder="Escolha…"
          defaultValue={v.kind}
          errors={e.kind}
          onChange={(ev) => setKind(ev.target.value)}
        />
      </div>
      {hint && (
        <p
          role="note"
          className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          {hint}
        </p>
      )}
      <TextAreaField
        label="Descrição (opcional)"
        name="description"
        maxLength={2000}
        defaultValue={v.description}
        errors={e.description}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Início (horário de Brasília)"
          name="startsAt"
          type="datetime-local"
          required
          defaultValue={v.startsAt}
          errors={e.startsAt}
        />
        <Field
          label="Término"
          name="endsAt"
          type="datetime-local"
          required
          defaultValue={v.endsAt}
          errors={e.endsAt}
        />
      </div>
      <Field
        label="Local (nome)"
        name="venueName"
        required
        placeholder="Ex.: Estacionamento do Parque X"
        defaultValue={v.venueName}
        errors={e.venueName}
      />
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <Field label="Rua (opcional)" name="street" defaultValue={v.street} errors={e.street} />
        <Field
          label="Número"
          name="streetNumber"
          defaultValue={v.streetNumber}
          errors={e.streetNumber}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_6rem]">
        <Field
          label="Bairro (opcional)"
          name="district"
          defaultValue={v.district}
          errors={e.district}
        />
        <Field label="Cidade" name="city" required defaultValue={v.city} errors={e.city} />
        <SelectField
          label="UF"
          name="state"
          options={STATE_OPTIONS}
          placeholder="—"
          defaultValue={v.state}
          errors={e.state}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Limite de participantes (opcional)"
          name="capacity"
          type="number"
          min={1}
          max={10000}
          defaultValue={v.capacity}
          errors={e.capacity}
        />
        {hostOptions.length > 0 && (
          <SelectField
            label="Parceiro anfitrião (opcional)"
            name="businessId"
            options={hostOptions}
            placeholder="Nenhum"
            defaultValue={v.businessId}
            errors={e.businessId}
          />
        )}
      </div>
      <SubmitButton pendingText="Salvando…">{submitLabel}</SubmitButton>
    </form>
  );
}
