"use client";

import { useState, useTransition } from "react";
import type { FormState } from "@/lib/forms";
import { FormMessage } from "./form";

/** Botão destrutivo com confirmação nativa; mostra o erro devolvido pela action. */
export function ConfirmActionButton({
  action,
  confirmText,
  label,
  pendingLabel,
}: {
  action: () => Promise<FormState | void>;
  confirmText: string;
  label: string;
  pendingLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <FormMessage error={error ?? undefined} />
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(confirmText)) return;
          startTransition(async () => {
            const result = await action();
            if (result?.error) setError(result.error);
          });
        }}
        className="self-start rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
      >
        {pending ? pendingLabel : label}
      </button>
    </div>
  );
}
