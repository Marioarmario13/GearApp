import { listActiveOffers, offerRemaining } from "@gearhead/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Ofertas — Gearhead",
  description: "Descontos de parceiros verificados. Pegue o cupom e apresente no estabelecimento.",
};

const dateBR = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export default function OffersPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-12 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Ofertas</h1>
          <p className="max-w-2xl text-muted">
            Descontos de parceiros verificados. Pegue o cupom e apresente o código no balcão.
          </p>
        </div>
        <Link
          href="/meus-cupons"
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium"
        >
          Meus cupons
        </Link>
      </header>
      <Suspense fallback={<p className="text-muted">Carregando ofertas…</p>}>
        <OfferList />
      </Suspense>
    </main>
  );
}

async function OfferList() {
  const offers = await listActiveOffers(await createClient());
  if (offers.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line p-10 text-center">
        <p className="text-lg font-semibold">Nenhuma oferta no momento</p>
      </div>
    );
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {offers.map((o) => {
        const remaining = offerRemaining(o);
        return (
          <li key={o.id}>
            <Link
              href={`/ofertas/${o.id}`}
              className="flex h-full flex-col gap-1.5 rounded-2xl border border-line bg-surface p-5 hover:border-accent"
            >
              <p className="text-2xl font-bold text-accent">{o.discount_label}</p>
              <p className="font-semibold">{o.title}</p>
              <p className="text-sm text-muted">
                ✓ {o.business?.name} · {o.business?.city}/{o.business?.state}
              </p>
              <p className="text-xs text-muted">
                Até {dateBR(o.ends_at)}
                {remaining !== null &&
                  ` · ${remaining === 0 ? "esgotado" : `${remaining} restante(s)`}`}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
