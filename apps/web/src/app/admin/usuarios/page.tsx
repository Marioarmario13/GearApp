import {
  adminListSuspensions,
  dataErrorMessage,
  normalizePeopleQuery,
  searchProfiles,
  type PersonResult,
} from "@gearhead/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { suspendUserAction, unsuspendUserAction } from "@/app/actions/community";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ReviewForm, type Decision } from "../review-form";

export const metadata: Metadata = { title: "Usuários — Gearhead", robots: { index: false } };

type Search = Record<string, string | string[] | undefined>;

const SUSPEND: Decision[] = [
  { value: "suspend", label: "Suspender conta", pendingLabel: "Suspendendo…", variant: "danger" },
];
const UNSUSPEND: Decision[] = [
  { value: "unsuspend", label: "Reativar conta", pendingLabel: "Reativando…", variant: "primary" },
];

export default function UsersPage({ searchParams }: PageProps<"/admin/usuarios">) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-12">
      <Link href="/admin" className="text-sm text-muted hover:underline">
        ← Administração
      </Link>
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Usuários</h1>
        <p className="text-sm text-muted">
          Suspender encerra as sessões e o compartilhamento de localização da pessoa, impede novo
          login e bloqueia o acesso aos dados até a reativação. Toda decisão exige motivo e fica na
          auditoria.
        </p>
      </header>
      <Suspense fallback={<p className="text-muted">Carregando…</p>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Content({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const supabase = await createClient();
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.slice(0, 60) ?? "";

  const suspensions = await adminListSuspensions(supabase);
  const suspended = new Set(suspensions.map((s) => s.user_id));
  let results: PersonResult[] | null = null;
  let error: string | null = null;
  if (q.trim()) {
    if (!normalizePeopleQuery(q)) error = "Digite de 3 a 30 caracteres para buscar.";
    else {
      try {
        results = await searchProfiles(supabase, q);
      } catch (e) {
        error = dataErrorMessage(e);
      }
    }
  }

  return (
    <>
      <section className="flex flex-col gap-3">
        <form method="get" role="search" className="flex gap-2">
          <label className="sr-only" htmlFor="busca-usuarios">
            Buscar usuários
          </label>
          <input
            id="busca-usuarios"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Nome ou @usuário"
            minLength={3}
            maxLength={31}
            autoComplete="off"
            className="flex-1 rounded-lg border border-line bg-surface px-3 py-2"
          />
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 font-medium text-white hover:opacity-90"
          >
            Buscar
          </button>
        </form>
        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {error}
          </p>
        )}
        {results && (
          <ul aria-label="Resultados da busca" className="flex flex-col gap-3">
            {results.length === 0 && <li className="text-muted">Ninguém encontrado.</li>}
            {results.map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4"
              >
                <Link href={`/u/${p.username}`} className="font-medium hover:underline">
                  {p.display_name ?? p.username} <span className="text-muted">@{p.username}</span>
                </Link>
                {suspended.has(p.id) ? (
                  <p className="text-sm font-medium text-red-700 dark:text-red-400">
                    Conta suspensa (veja abaixo).
                  </p>
                ) : (
                  <ReviewForm
                    action={suspendUserAction.bind(null, p.id)}
                    decisions={SUSPEND}
                    noteLabel="Motivo da suspensão (obrigatório, auditado)"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Contas suspensas ({suspensions.length})</h2>
        {suspensions.length === 0 && <p className="text-muted">Nenhuma conta suspensa.</p>}
        {suspensions.map((s) => (
          <article
            key={s.user_id}
            className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium">
                {s.display_name ?? s.username ?? "Sem nome"}{" "}
                {s.username && <span className="text-muted">@{s.username}</span>}
              </p>
              <p className="text-xs text-muted">
                {new Date(s.suspended_at).toLocaleString("pt-BR")} · por @
                {s.suspended_by_username ?? "?"}
              </p>
            </div>
            <p className="text-sm">{s.reason}</p>
            <ReviewForm
              action={unsuspendUserAction.bind(null, s.user_id)}
              decisions={UNSUSPEND}
              noteLabel="Motivo da reativação (obrigatório, auditado)"
            />
          </article>
        ))}
      </section>
    </>
  );
}
