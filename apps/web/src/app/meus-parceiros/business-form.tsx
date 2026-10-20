"use client";

import {
  BRAZIL_STATES,
  BUSINESS_KIND_LABELS,
  BUSINESS_KINDS,
  MAX_SPECIALTIES_PER_BUSINESS,
  type Business,
  type Specialty,
} from "@gearhead/shared";
import { useActionState } from "react";
import { Field, FormMessage, SelectField, SubmitButton, TextAreaField } from "@/components/form";
import type { FormState } from "@/lib/forms";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

const KIND_OPTIONS = BUSINESS_KINDS.map((k) => ({ value: k, label: BUSINESS_KIND_LABELS[k] }));
const STATE_OPTIONS = BRAZIL_STATES.map((uf) => ({ value: uf, label: uf }));

export function BusinessForm({
  action,
  business,
  specialties,
  submitLabel,
}: {
  action: Action;
  business?: Business;
  specialties: Specialty[];
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const e = state.fieldErrors ?? {};
  const v = state.values ?? {
    kind: business?.kind ?? "",
    name: business?.name ?? "",
    description: business?.description ?? "",
    phone: business?.phone ?? "",
    phoneIsWhatsapp: business?.phone_is_whatsapp ? "on" : "",
    email: business?.email ?? "",
    website: business?.website ?? "",
    street: business?.street ?? "",
    streetNumber: business?.street_number ?? "",
    district: business?.district ?? "",
    city: business?.city ?? "",
    state: business?.state ?? "",
    postalCode: business?.postal_code ?? "",
    specialties: business?.specialties.map((s) => s.id).join(",") ?? "",
  };
  const selected = new Set((v.specialties ?? "").split(",").filter(Boolean));

  return (
    // key: remonta após cada resposta para reaplicar defaultValue/defaultChecked.
    <form key={JSON.stringify(v)} action={formAction} className="flex flex-col gap-5" noValidate>
      <FormMessage error={state.error} success={state.success} />

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-lg font-semibold">Identificação</legend>
        <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
          <Field
            label="Nome do estabelecimento"
            name="name"
            required
            defaultValue={v.name}
            errors={e.name}
          />
          <SelectField
            label="Tipo"
            name="kind"
            options={KIND_OPTIONS}
            placeholder="Escolha…"
            defaultValue={v.kind}
            errors={e.kind}
          />
        </div>
        {business && (
          <p className="text-xs text-muted">
            Alterar nome ou tipo de um parceiro verificado o devolve para nova conferência.
          </p>
        )}
        <TextAreaField
          label="Descrição (opcional)"
          name="description"
          maxLength={1000}
          defaultValue={v.description}
          errors={e.description}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-lg font-semibold">Contato</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Field
              label="Telefone com DDD (opcional)"
              name="phone"
              inputMode="tel"
              autoComplete="tel"
              defaultValue={v.phone}
              errors={e.phone}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="phoneIsWhatsapp"
                defaultChecked={v.phoneIsWhatsapp === "on"}
              />
              Este número é WhatsApp
            </label>
          </div>
          <Field
            label="E-mail (opcional)"
            name="email"
            type="email"
            defaultValue={v.email}
            errors={e.email}
          />
        </div>
        <Field
          label="Site ou rede social (opcional)"
          name="website"
          defaultValue={v.website}
          errors={e.website}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-lg font-semibold">Endereço</legend>
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <Field label="Rua (opcional)" name="street" defaultValue={v.street} errors={e.street} />
          <Field
            label="Número"
            name="streetNumber"
            defaultValue={v.streetNumber}
            errors={e.streetNumber}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_6rem_9rem]">
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
          <Field
            label="CEP"
            name="postalCode"
            inputMode="numeric"
            defaultValue={v.postalCode}
            errors={e.postalCode}
          />
        </div>
        <p className="text-xs text-muted">
          A localização no mapa chega com o Radar. Por enquanto, a busca é por cidade e UF.
        </p>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-lg font-semibold">Especialidades</legend>
        <p className="text-xs text-muted">Escolha até {MAX_SPECIALTIES_PER_BUSINESS}.</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {specialties.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="specialties"
                value={s.id}
                defaultChecked={selected.has(s.id)}
              />
              {s.name}
            </label>
          ))}
        </div>
        {e.specialties && (
          <p className="text-sm text-red-600 dark:text-red-400">{e.specialties.join(" ")}</p>
        )}
      </fieldset>

      <SubmitButton pendingText="Salvando…">{submitLabel}</SubmitButton>
    </form>
  );
}
