"use client";

import {
  CREDENTIAL_TYPE_LABELS,
  CREDENTIAL_TYPES,
  DOCUMENT_MIME_TYPES,
  validateDocument,
  type Specialty,
} from "@gearhead/shared";
import { useActionState, useId, useState } from "react";
import { Field, FormMessage, SelectField, SubmitButton } from "@/components/form";
import type { FormState } from "@/lib/forms";

const ACCEPT = Object.keys(DOCUMENT_MIME_TYPES).join(",");
const TYPE_OPTIONS = CREDENTIAL_TYPES.map((t) => ({ value: t, label: CREDENTIAL_TYPE_LABELS[t] }));

export function CredentialUploader({
  action,
  specialties,
  hasRegistration,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  specialties: Specialty[];
  hasRegistration: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const [fileError, setFileError] = useState<string | null>(null);
  const fileId = useId();
  const e = state.fieldErrors ?? {};
  const v = state.values ?? { type: hasRegistration ? "certification" : "business_registration" };

  return (
    <form
      key={JSON.stringify(v)}
      action={formAction}
      className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5"
      noValidate
    >
      <h3 className="text-lg font-semibold">Enviar documento</h3>
      <FormMessage
        error={fileError ?? state.error}
        success={fileError ? undefined : state.success}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Tipo"
          name="type"
          options={TYPE_OPTIONS}
          defaultValue={v.type}
          errors={e.type}
        />
        <Field
          label="Título"
          name="title"
          required
          placeholder="Ex.: Comprovante de CNPJ, Curso de injeção…"
          defaultValue={v.title}
          errors={e.title}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Emitido por (opcional)"
          name="issuer"
          defaultValue={v.issuer}
          errors={e.issuer}
        />
        <SelectField
          label="Especialidade relacionada (opcional)"
          name="specialtyId"
          options={specialties.map((s) => ({ value: s.id, label: s.name }))}
          placeholder="—"
          defaultValue={v.specialtyId}
          errors={e.specialtyId}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Emissão (opcional)"
          name="issuedOn"
          type="date"
          defaultValue={v.issuedOn}
          errors={e.issuedOn}
        />
        <Field
          label="Validade (opcional)"
          name="expiresOn"
          type="date"
          defaultValue={v.expiresOn}
          errors={e.expiresOn}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={fileId} className="text-sm font-medium">
          Arquivo (PDF, JPG, PNG ou WebP, até 10 MB)
        </label>
        <input
          id={fileId}
          name="document"
          type="file"
          accept={ACCEPT}
          required
          onChange={(ev) => {
            // Pré-validação para feedback imediato; servidor e bucket validam de novo.
            const file = ev.currentTarget.files?.[0];
            setFileError(file ? validateDocument(file) : null);
          }}
          className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-2 file:font-semibold file:text-white"
        />
        {e.document && (
          <p className="text-sm text-red-600 dark:text-red-400">{e.document.join(" ")}</p>
        )}
        <p className="text-xs text-muted">
          Documentos ficam privados: só você e a equipe de conferência têm acesso.
        </p>
      </div>
      <div>
        <SubmitButton pendingText="Enviando…">Enviar para conferência</SubmitButton>
      </div>
    </form>
  );
}
