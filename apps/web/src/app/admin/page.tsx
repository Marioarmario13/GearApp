import { getReviewQueue, listBusinessesByIds } from "@gearhead/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BusinessCard } from "@/components/partners";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Administração — Gearhead", robots: { index: false } };

export default function AdminPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-12 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight">Administração</h1>
      <nav aria-label="Seções" className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/admin/denuncias"
          className="rounded-lg border border-line px-3 py-1.5 font-medium"
        >
          Denúncias
        </Link>
        <Link
          href="/admin/usuarios"
          className="rounded-lg border border-line px-3 py-1.5 font-medium"
        >
          Usuários
        </Link>
        <Link
          href="/admin/auditoria"
          className="rounded-lg border border-line px-3 py-1.5 font-medium"
        >
          Auditoria
        </Link>
      </nav>
      <Suspense fallback={<p className="text-muted">Carregando fila…</p>}>
        <Queue />
      </Suspense>
    </main>
  );
}

async function Queue() {
  await requireAdmin();
  const supabase = await createClient();
  const queue = await getReviewQueue(supabase);
  const pendingIds = new Set(queue.businesses.map((b) => b.id));
  // Parceiros já aprovados (ou recusados) que enviaram novos documentos.
  const withDocs = await listBusinessesByIds(
    supabase,
    queue.businessIdsWithPendingCredentials.filter((id) => !pendingIds.has(id)),
  );

  return (
    <>
      <section aria-labelledby="fila-parceiros" className="flex flex-col gap-4">
        <h2 id="fila-parceiros" className="text-xl font-semibold">
          Cadastros aguardando conferência ({queue.businesses.length})
        </h2>
        {queue.businesses.length === 0 ? (
          <p className="text-muted">Nenhum cadastro pendente. 🎉</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {queue.businesses.map((b) => (
              <li key={b.id}>
                <BusinessCard business={b} href={`/admin/parceiros/${b.id}`} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="fila-docs" className="flex flex-col gap-4">
        <h2 id="fila-docs" className="text-xl font-semibold">
          Outros parceiros com documentos novos ({withDocs.length})
        </h2>
        {withDocs.length === 0 ? (
          <p className="text-muted">Nenhum documento novo.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {withDocs.map((b) => (
              <li key={b.id}>
                <BusinessCard business={b} href={`/admin/parceiros/${b.id}`} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
