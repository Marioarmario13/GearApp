import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Auditoria — Gearhead", robots: { index: false } };

export default function AuditPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-12">
      <Link href="/admin" className="text-sm text-muted hover:underline">
        ← Administração
      </Link>
      <h1 className="text-3xl font-bold tracking-tight">Auditoria</h1>
      <p className="text-sm text-muted">
        Últimas 100 ações administrativas e mudanças sensíveis (somente leitura).
      </p>
      <Suspense fallback={<p className="text-muted">Carregando…</p>}>
        <Log />
      </Suspense>
    </main>
  );
}

async function Log() {
  await requireAdmin();
  // RLS: só admins leem audit_logs.
  const { data, error } = await (
    await createClient()
  )
    .from("audit_logs")
    .select(
      "id, actor_id, action, entity_type, entity_id, details, created_at, actor:profiles(username)",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Falha ao carregar a auditoria.");
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface">
          <tr>
            <th className="p-3">Quando</th>
            <th className="p-3">Quem</th>
            <th className="p-3">Ação</th>
            <th className="p-3">Alvo</th>
            <th className="p-3">Detalhes</th>
          </tr>
        </thead>
        <tbody>
          {data.map((a) => (
            <tr key={a.id} className="border-t border-line align-top">
              <td className="p-3 whitespace-nowrap">
                {new Date(a.created_at).toLocaleString("pt-BR")}
              </td>
              <td className="p-3">
                @{(a.actor as { username: string | null } | null)?.username ?? "sistema"}
              </td>
              <td className="p-3 font-mono text-xs">{a.action}</td>
              <td className="p-3 font-mono text-xs">
                {a.entity_type}/{a.entity_id.slice(0, 8)}
              </td>
              <td className="p-3 font-mono text-xs break-all">{JSON.stringify(a.details)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
