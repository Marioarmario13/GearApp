"use client";

import { MIN_VEHICLE_YEAR, type VehicleWithPlate } from "@gearhead/shared";
import { useActionState, useId } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import type { FormState } from "@/lib/forms";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export function VehicleForm({
  action,
  vehicle,
  submitLabel,
}: {
  action: Action;
  vehicle?: VehicleWithPlate;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const visibilityId = useId();
  const e = state.fieldErrors ?? {};
  const v = state.values ?? {
    make: vehicle?.make ?? "",
    model: vehicle?.model ?? "",
    year: vehicle ? String(vehicle.year) : "",
    nickname: vehicle?.nickname ?? "",
    plate: vehicle?.plate ?? "",
    visibility: vehicle?.visibility ?? "private",
  };

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormMessage error={state.error} success={state.success} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Marca" name="make" required defaultValue={v.make} errors={e.make} />
        <Field label="Modelo" name="model" required defaultValue={v.model} errors={e.model} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Ano"
          name="year"
          inputMode="numeric"
          required
          min={MIN_VEHICLE_YEAR}
          defaultValue={v.year}
          errors={e.year}
        />
        <Field
          label="Apelido (opcional)"
          name="nickname"
          defaultValue={v.nickname}
          errors={e.nickname}
        />
      </div>
      <Field
        label="Placa (opcional)"
        name="plate"
        autoCapitalize="characters"
        defaultValue={v.plate}
        errors={e.plate}
        hint="Visível somente para você. Nunca aparece no perfil público."
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={visibilityId} className="text-sm font-medium">
          Visibilidade
        </label>
        <select
          // key força remontagem: o reset de formulário do React 19 não reaplica defaultValue em <select>.
          key={v.visibility}
          id={visibilityId}
          name="visibility"
          defaultValue={v.visibility}
          aria-describedby={`${visibilityId}-hint`}
          className="rounded-lg border border-line bg-surface px-3 py-2"
        >
          <option value="private">Privado — só você vê</option>
          <option value="public">Público — membros do Gearhead podem ver</option>
        </select>
        <p id={`${visibilityId}-hint`} className="text-xs text-muted">
          Fotos seguem a visibilidade do veículo.
        </p>
      </div>
      <SubmitButton pendingText="Salvando…">{submitLabel}</SubmitButton>
    </form>
  );
}
