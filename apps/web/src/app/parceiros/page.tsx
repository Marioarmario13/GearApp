import {
  BRAZIL_STATES,
  BUSINESS_KIND_LABELS,
  BUSINESS_KINDS,
  listDirectory,
  listSpecialties,
  type BrazilState,
  type BusinessKind,
} from "@gearhead/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BusinessCard } from "@/components/partners";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Parceiros verificados — Gearhead",
  description:
    "Oficinas, mecânicos, preparadores e lojas com registro conferido pela equipe Gearhead.",
};

type Search = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Lê e valida filtros da URL (valores desconhecidos são ignorados). */
function parseFilters(sp: Search) {
  const kind = one(sp.tipo);
  const state = one(sp.uf).toUpperCase();
  const page = Number.parseInt(one(sp.pagina), 10);
  return {
    kind: (BUSINESS_KINDS as readonly string[]).includes(kind) ? (kind as BusinessKind) : null,
    state: (BRAZIL_STATES as readonly string[]).includes(state) ? (state as BrazilState) : null,
    specialty: /^[a-z0-9-]{1,40}$/.test(one(sp.especialidade)) ? one(sp.especialidade) : null,
    city: one(sp.cidade).trim().slice(0, 80) || null,
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 500) : 1,
  };
}

export default function DirectoryPage({ searchParams }: PageProps<"/parceiros">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-12 sm:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Parceiros verificados</h1>
        <p className="max-w-2xl text-muted">
          Só aparecem aqui estabelecimentos cujo registro (CNPJ ou MEI) foi conferido pela nossa
          equipe. Certificações exibidas também foram conferidas uma a uma.
        </p>
      </header>
      <Suspense fallback={<p className="text-muted">Carregando parceiros…</p>}>
        <Directory searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Directory({ searchParams }: { searchParams: Promise<Search> }) {
  const filters = parseFilters(await searchParams);
  const supabase = await createClient();
  const [specialties, { items, hasMore }] = await Promise.all([
    listSpecialties(supabase),
    listDirectory(supabase, filters),
  ]);

  const pageHref = (page: number) => {
    const qs = new URLSearchParams();
    if (filters.kind) qs.set("tipo", filters.kind);
    if (filters.specialty) qs.set("especialidade", filters.specialty);
    if (filters.state) qs.set("uf", filters.state);
    if (filters.city) qs.set("cidade", filters.city);
    if (page > 1) qs.set("pagina", String(page));
    const s = qs.toString();
    return s ? `/parceiros?${s}` : "/parceiros";
  };

  return (
    <>
      <form
        method="get"
        role="search"
        className="grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-[1fr_1fr_6rem_1fr_auto] sm:items-end"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Tipo</span>
          <select
            name="tipo"
            defaultValue={filters.kind ?? ""}
            className="rounded-lg border border-line bg-surface px-3 py-2"
          >
            <option value="">Todos</option>
            {BUSINESS_KINDS.map((k) => (
              <option key={k} value={k}>
                {BUSINESS_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Especialidade</span>
          <select
            name="especialidade"
            defaultValue={filters.specialty ?? ""}
            className="rounded-lg border border-line bg-surface px-3 py-2"
          >
            <option value="">Todas</option>
            {specialties.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">UF</span>
          <select
            name="uf"
            defaultValue={filters.state ?? ""}
            className="rounded-lg border border-line bg-surface px-3 py-2"
          >
            <option value="">—</option>
            {BRAZIL_STATES.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Cidade</span>
          <input
            name="cidade"
            defaultValue={filters.city ?? ""}
            maxLength={80}
            className="rounded-lg border border-line bg-surface px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 font-semibold text-white hover:opacity-90"
        >
          Filtrar
        </button>
      </form>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center">
          <p className="text-lg font-semibold">Nenhum parceiro encontrado</p>
          <p className="mt-1 text-muted">Tente remover algum filtro.</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {items.map((b) => (
            <li key={b.id}>
              <BusinessCard business={b} href={`/parceiros/${b.id}`} />
            </li>
          ))}
        </ul>
      )}

      {(filters.page > 1 || hasMore) && (
        <nav aria-label="Paginação" className="flex items-center justify-between">
          {filters.page > 1 ? (
            <Link
              href={pageHref(filters.page - 1)}
              className="text-sm font-medium text-accent hover:underline"
            >
              ← Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted">Página {filters.page}</span>
          {hasMore ? (
            <Link
              href={pageHref(filters.page + 1)}
              className="text-sm font-medium text-accent hover:underline"
            >
              Próxima →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}

      <p className="text-sm text-muted">
        Tem uma oficina ou serviço?{" "}
        <Link href="/meus-parceiros" className="font-medium text-accent hover:underline">
          Cadastre seu estabelecimento
        </Link>
        .
      </p>
    </>
  );
}
