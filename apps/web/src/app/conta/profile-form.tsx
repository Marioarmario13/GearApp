"use client";

import { BRAZIL_STATES, type PublicProfile } from "@gearhead/shared";
import { useActionState, useId } from "react";
import { updateProfile } from "@/app/actions/auth";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import type { FormState } from "@/lib/forms";

export function ProfileForm({ profile }: { profile: PublicProfile }) {
  const [state, action] = useActionState<FormState, FormData>(updateProfile, {});
  const stateId = useId();
  const e = state.fieldErrors ?? {};
  const v = state.values ?? {
    username: profile.username ?? "",
    displayName: profile.display_name ?? "",
    city: profile.city ?? "",
    state: profile.state ?? "",
  };

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage error={state.error} success={state.success} />
      <Field
        label="Nome"
        name="displayName"
        required
        defaultValue={v.displayName}
        errors={e.displayName}
      />
      <Field
        label="Nome de usuário"
        name="username"
        required
        defaultValue={v.username}
        errors={e.username}
        hint="3 a 30 caracteres: letras minúsculas, números ou _"
      />
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <Field label="Cidade" name="city" defaultValue={v.city} errors={e.city} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor={stateId} className="text-sm font-medium">
            UF
          </label>
          <select
            // key força remontagem: o reset de formulário do React 19 não reaplica defaultValue em <select>.
            key={v.state}
            id={stateId}
            name="state"
            defaultValue={v.state}
            className="rounded-lg border border-line bg-surface px-3 py-2"
          >
            <option value="">—</option>
            {BRAZIL_STATES.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
          {e.state && <p className="text-sm text-red-600 dark:text-red-400">{e.state.join(" ")}</p>}
        </div>
      </div>
      <SubmitButton pendingText="Salvando…">Salvar perfil</SubmitButton>
    </form>
  );
}
