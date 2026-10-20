import { listMyBusinesses, MAX_BUSINESSES_PER_USER } from "@gearhead/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BusinessCard } from "@/components/partners";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Meus estabelecimentos — Gearhead" };

export default function MyBusinessesPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-12 sm:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Meus estabelecimentos</h1>
        <p className="max-w-2xl text-muted">
          Cadastre sua oficina, serviço ou loja. Ela aparece no diretório depois que nossa equipe
          conferir o documento de registro (CNPJ ou MEI).
        </p>
      </header>
      <Suspense fallback={<p className="text-muted">Carregando…</p>}>
        <BusinessList />
      </Suspense>
    </main>
  );
}

async function BusinessList() {
  const user = await requireUser();
  const businesses = await listMyBusinesses(await createClient(), user.id);
  const canAdd = businesses.length < MAX_BUSINESSES_PER_USER;

  return (
    <>
      {canAdd ? (
        <Link
          href="/meus-parceiros/novo"
          className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Cadastrar estabelecimento
        </Link>
      ) : (
        <p className="text-sm text-muted">
          Limite de {MAX_BUSINESSES_PER_USER} estabelecimentos por conta atingido.
        </p>
      )}
      {businesses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center">
          <p className="text-lg font-semibold">Nenhum estabelecimento cadastrado</p>
          <p className="mt-1 text-muted">É gratuito e leva poucos minutos.</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {businesses.map((b) => (
            <li key={b.id}>
              <BusinessCard business={b} href={`/meus-parceiros/${b.id}`} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
