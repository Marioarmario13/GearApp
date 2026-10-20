"use client";

import { MAX_PHOTOS_PER_VEHICLE, PHOTO_MIME_TYPES, validatePhoto } from "@gearhead/shared";
import { useActionState, useId, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import type { FormState } from "@/lib/forms";

const ACCEPT = Object.keys(PHOTO_MIME_TYPES).join(",");

export function PhotoUploader({
  action,
  photoCount,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  photoCount: number;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const [clientError, setClientError] = useState<string | null>(null);
  const inputId = useId();

  if (photoCount >= MAX_PHOTOS_PER_VEHICLE) {
    return <p className="text-sm text-muted">Limite de {MAX_PHOTOS_PER_VEHICLE} fotos atingido.</p>;
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4"
    >
      <FormMessage
        error={clientError ?? state.error}
        success={clientError ? undefined : state.success}
      />
      <label htmlFor={inputId} className="text-sm font-medium">
        Adicionar foto (JPG, PNG ou WebP, até 5 MB)
      </label>
      <input
        id={inputId}
        name="photo"
        type="file"
        accept={ACCEPT}
        required
        onChange={(e) => {
          // Pré-validação para feedback imediato; o servidor e o bucket validam de novo.
          const file = e.currentTarget.files?.[0];
          setClientError(file ? validatePhoto(file) : null);
        }}
        className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-2 file:font-semibold file:text-white"
      />
      <div>
        <SubmitButton pendingText="Enviando…">Enviar foto</SubmitButton>
      </div>
    </form>
  );
}
