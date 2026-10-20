import { BRAZIL_STATES, listUpcomingEvents, type BrazilState } from "@gearhead/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EventCard } from "@/components/events";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Eventos — Gearhead",
  description: "Encontros, exposições, passeios e track days (em autódromo) perto de você.",
};

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default function EventsPage({ searchParams }: PageProps<"/eventos">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-12 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Eventos</h1>
          <p className="max-w-2xl text-muted">
            Encontros e passeios da comunidade. Nada de disputas em via pública: velocidade, só em
            autódromo.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/eventos/meus"
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium"
          >
            Meus eventos
          </Link>
          <Link
            href="/eventos/novo"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Criar evento
          </Link>
        </div>
      </header>
      <Suspense fallback={<p className="text-muted">Carregando eventos…</p>}>
        <EventList searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function EventList({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const uf = one(sp.uf).toUpperCase();
  const state = (BRAZIL_STATES as readonly string[]).includes(uf) ? (uf as BrazilState) : null;
  const city = one(sp.cidade).trim().slice(0, 80) || null;
  const pageNum = Number.parseInt(one(sp.pagina), 10);
  const page = Number.isFinite(pageNum) && pageNum > 0 ? Math.min(pageNum, 500) : 1;
  const { items, hasMore } = await listUpcomingEvents(await createClient(), { state, city, page });

  const href = (p: number) => {
    const qs = new URLSearchParams();
    if (state) qs.set("uf", state);
    if (city) qs.set("cidade", city);
    if (p > 1) qs.set("pagina", String(p));
    const s = qs.toString();
    return s ? `/eventos?${s}` : "/eventos";
  };

  return (
    <>
      <form
        method="get"
        role="search"
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-4"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">UF</span>
          <select
            name="uf"
            defaultValue={state ?? ""}
            className="rounded-lg border border-line bg-surface px-3 py-2"
          >
            <option value="">Todas</option>
            {BRAZIL_STATES.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Cidade</span>
          <input
            name="cidade"
            defaultValue={city ?? ""}
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
          <p className="text-lg font-semibold">Nenhum evento agendado</p>
          <p className="mt-1 text-muted">Que tal organizar o primeiro?</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {items.map((ev) => (
            <li key={ev.id}>
              <EventCard event={ev} />
            </li>
          ))}
        </ul>
      )}
      {(page > 1 || hasMore) && (
        <nav aria-label="Paginação" className="flex justify-between text-sm">
          {page > 1 ? (
            <Link href={href(page - 1)} className="text-accent hover:underline">
              ← Anteriores
            </Link>
          ) : (
            <span />
          )}
          {hasMore ? (
            <Link href={href(page + 1)} className="text-accent hover:underline">
              Próximos →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
