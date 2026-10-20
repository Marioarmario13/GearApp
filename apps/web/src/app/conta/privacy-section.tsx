"use client";

import { DELETE_CONFIRMATION } from "@gearhead/shared";
import { useActionState } from "react";
import { deleteAccountAction } from "@/app/actions/auth";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import type { FormState } from "@/lib/forms";

export function PrivacySection() {
  const [state, formAction] = useActionState<FormState, FormData>(deleteAccountAction, {});
  return (
    <section
      aria-labelledby="privacidade"
      className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6"
    >
      <h2 id="privacidade" className="text-xl font-semibold">
        Privacidade e seus dados
      </h2>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted">
          Baixe uma cópia de tudo o que guardamos sobre você (perfil, garagem, parceiros, eventos,
          cupons, amizades, denúncias feitas e compartilhamentos de localização).
        </p>
        <a
          href="/conta/dados"
          className="self-start rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-background"
        >
          Baixar meus dados (JSON)
        </a>
      </div>
      <form action={formAction} className="flex flex-col gap-3 border-t border-line pt-4">
        <h3 className="font-semibold text-red-700 dark:text-red-400">Excluir minha conta</h3>
        <p className="text-sm text-muted">
          Apaga definitivamente sua conta, perfil, veículos e fotos, parceiros e documentos,
          eventos, cupons, amizades e localizações. Não pode ser desfeito.
        </p>
        <FormMessage error={state.error} />
        <Field
          label={`Para confirmar, digite ${DELETE_CONFIRMATION}`}
          name="confirmation"
          autoComplete="off"
          errors={state.fieldErrors?.confirmation}
        />
        <div>
          <SubmitButton pendingText="Excluindo…" variant="danger">
            Excluir minha conta
          </SubmitButton>
        </div>
      </form>
    </section>
  );
}
