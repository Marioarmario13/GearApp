"use client";

import { formatCouponCode } from "@gearhead/shared";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { ClaimState } from "@/app/actions/offers";
import { FormMessage } from "@/components/form";

export function ClaimButton({
  claim,
  signedIn,
  offerId,
}: {
  claim: () => Promise<ClaimState>;
  signedIn: boolean;
  offerId: string;
}) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<ClaimState>({});

  if (!signedIn) {
    return (
      <Link
        href={`/entrar?next=/ofertas/${offerId}`}
        className="self-start rounded-lg bg-accent px-4 py-2.5 font-semibold text-white hover:opacity-90"
      >
        Entre para pegar o cupom
      </Link>
    );
  }

  if (state.code) {
    return (
      <div
        role="status"
        className="flex flex-col gap-2 rounded-2xl border-2 border-dashed border-accent p-5 text-center"
      >
        <p className="text-sm text-muted">Apresente este código no estabelecimento:</p>
        <p className="font-mono text-3xl font-bold tracking-widest">
          {formatCouponCode(state.code)}
        </p>
        <Link href="/meus-cupons" className="text-sm text-accent hover:underline">
          Ver meus cupons
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <FormMessage error={state.error} />
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setState(await claim()))}
        className="self-start rounded-lg bg-accent px-4 py-2.5 font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Gerando…" : "Pegar cupom"}
      </button>
    </div>
  );
}
