import { getOffer, offerRemaining } from "@gearhead/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { claimOfferAction } from "@/app/actions/offers";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ReportButton } from "@/components/community";
import { ClaimButton } from "./claim-button";

export const metadata: Metadata = { title: "Oferta — Gearhead" };

const dateBR = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export default function OfferPage({ params }: PageProps<"/ofertas/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <Link href="/ofertas" className="text-sm text-muted hover:underline">
        ← Ofertas
      </Link>
      <Suspense fallback={<p className="text-muted">Carregando…</p>}>
        <Offer params={params} />
      </Suspense>
    </main>
  );
}

async function Offer({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [offer, user] = await Promise.all([getOffer(await createClient(), id), getCurrentUser()]);
  if (!offer) notFound();
  const remaining = offerRemaining(offer);
  const live = offer.status === "active" && new Date(offer.ends_at) > new Date();

  return (
    <>
      <header className="flex flex-col gap-2">
        <p className="text-4xl font-bold text-accent">{offer.discount_label}</p>
        <h1 className="text-2xl font-bold tracking-tight">{offer.title}</h1>
        {offer.business && (
          <Link href={`/parceiros/${offer.business.id}`} className="text-accent hover:underline">
            ✓ {offer.business.name} · {offer.business.city}/{offer.business.state}
          </Link>
        )}
        <p className="text-sm text-muted">
          Válida até {dateBR(offer.ends_at)} · até {offer.per_user_limit} cupom(ns) por pessoa
          {remaining !== null && ` · ${remaining} restante(s)`}
        </p>
      </header>
      {offer.description && <p className="whitespace-pre-line">{offer.description}</p>}
      {offer.terms && (
        <section className="rounded-xl border border-line p-4 text-sm">
          <h2 className="mb-1 font-semibold">Regras</h2>
          <p className="whitespace-pre-line text-muted">{offer.terms}</p>
        </section>
      )}
      {live && remaining !== 0 ? (
        <ClaimButton
          claim={claimOfferAction.bind(null, offer.id)}
          signedIn={Boolean(user)}
          offerId={offer.id}
        />
      ) : (
        <p className="text-muted">Esta oferta não está disponível no momento.</p>
      )}
      {user && <ReportButton targetType="offer" targetId={offer.id} />}
      <p className="text-xs text-muted">
        O desconto é concedido pelo estabelecimento. O Gearhead não processa pagamentos.
      </p>
    </>
  );
}
