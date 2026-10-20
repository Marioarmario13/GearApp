import { listSpecialties } from "@gearhead/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createBusinessAction } from "@/app/actions/partners";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BusinessForm } from "../business-form";

export const metadata: Metadata = { title: "Cadastrar estabelecimento — Gearhead" };

export default function NewBusinessPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-12">
      <Link href="/meus-parceiros" className="text-sm text-muted hover:underline">
        ← Meus estabelecimentos
      </Link>
      <h1 className="text-3xl font-bold tracking-tight">Cadastrar estabelecimento</h1>
      <section className="rounded-2xl border border-line bg-surface p-6">
        <Suspense fallback={<p className="text-muted">Carregando…</p>}>
          <NewBusinessForm />
        </Suspense>
      </section>
      <p className="text-sm text-muted">
        Depois de salvar, envie o documento de registro (CNPJ ou MEI) para conferência.
      </p>
    </main>
  );
}

async function NewBusinessForm() {
  await requireUser();
  const specialties = await listSpecialties(await createClient());
  return (
    <BusinessForm
      action={createBusinessAction}
      specialties={specialties}
      submitLabel="Salvar e continuar"
    />
  );
}
