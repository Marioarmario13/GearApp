import {
  dataErrorMessage,
  listMyBlocks,
  listMyFriendships,
  normalizePeopleQuery,
  searchProfiles,
  type Friendship,
} from "@gearhead/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  removeFriendshipAction,
  respondFriendRequestAction,
  unblockUserAction,
} from "@/app/actions/community";
import { ActionButton } from "@/components/community";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Amigos — Gearhead" };

type Search = Record<string, string | string[] | undefined>;

export default function FriendsPage({ searchParams }: PageProps<"/amigos">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Amigos</h1>
      <Suspense fallback={null}>
        <PeopleSearch searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<p className="text-muted">Carregando…</p>}>
        <Lists />
      </Suspense>
    </main>
  );
}

function Person({ f }: { f: Pick<Friendship, "username" | "display_name"> }) {
  return f.username ? (
    <Link href={`/u/${f.username}`} className="font-medium hover:underline">
      {f.display_name ?? f.username} <span className="text-muted">@{f.username}</span>
    </Link>
  ) : (
    <span className="font-medium">{f.display_name ?? "Sem nome"}</span>
  );
}

async function PeopleSearch({ searchParams }: { searchParams: Promise<Search> }) {
  await requireUser();
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.slice(0, 60) ?? "";
  let results: Awaited<ReturnType<typeof searchProfiles>> | null = null;
  let error: string | null = null;
  if (q.trim()) {
    if (!normalizePeopleQuery(q)) error = "Digite de 3 a 30 caracteres para buscar.";
    else {
      try {
        results = await searchProfiles(await createClient(), q);
      } catch (e) {
        error = dataErrorMessage(e);
      }
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <form method="get" role="search" className="flex gap-2">
        <label className="sr-only" htmlFor="busca-pessoas">
          Buscar pessoas
        </label>
        <input
          id="busca-pessoas"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Buscar pessoas por nome ou @usuário"
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
        <ul aria-label="Resultados da busca" className="flex flex-col gap-2">
          {results.length === 0 && <li className="text-muted">Ninguém encontrado.</li>}
          {results.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface p-3"
            >
              <Person f={p} />
              {p.city && (
                <span className="text-sm text-muted">
                  {p.city}
                  {p.state ? `/${p.state}` : ""}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

async function Lists() {
  await requireUser();
  const supabase = await createClient();
  const [links, blocks] = await Promise.all([listMyFriendships(supabase), listMyBlocks(supabase)]);
  const incoming = links.filter((f) => f.status === "pending" && f.incoming);
  const outgoing = links.filter((f) => f.status === "pending" && !f.incoming);
  const friends = links.filter((f) => f.status === "accepted");
  const row =
    "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3";

  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Pedidos recebidos ({incoming.length})</h2>
        {incoming.length === 0 && <p className="text-muted">Nenhum pedido pendente.</p>}
        {incoming.map((f) => (
          <div key={f.friendship_id} className={row}>
            <Person f={f} />
            <span className="flex gap-2">
              <ActionButton
                action={respondFriendRequestAction.bind(null, f.friendship_id, true)}
                label="Aceitar"
                pendingLabel="…"
                variant="primary"
              />
              <ActionButton
                action={respondFriendRequestAction.bind(null, f.friendship_id, false)}
                label="Recusar"
                pendingLabel="…"
              />
            </span>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Amigos ({friends.length})</h2>
        {friends.length === 0 && (
          <p className="text-muted">Busque alguém acima e abra o perfil para adicionar.</p>
        )}
        {friends.map((f) => (
          <div key={f.friendship_id} className={row}>
            <Person f={f} />
            <ActionButton
              action={removeFriendshipAction.bind(null, f.friendship_id, undefined)}
              label="Desfazer"
              pendingLabel="…"
              confirmText="Desfazer a amizade?"
              variant="danger"
            />
          </div>
        ))}
      </section>

      {outgoing.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Pedidos enviados ({outgoing.length})</h2>
          {outgoing.map((f) => (
            <div key={f.friendship_id} className={row}>
              <Person f={f} />
              <ActionButton
                action={removeFriendshipAction.bind(null, f.friendship_id, undefined)}
                label="Cancelar"
                pendingLabel="…"
              />
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Bloqueados ({blocks.length})</h2>
        <p className="text-sm text-muted">
          Quem você bloqueia não vê seu perfil nem seus veículos e não é avisado do bloqueio.
        </p>
        {blocks.map((b) => (
          <div key={b.user_id} className={row}>
            <span className="font-medium">
              {b.display_name ?? "Sem nome"}{" "}
              {b.username && <span className="text-muted">@{b.username}</span>}
            </span>
            <ActionButton
              action={unblockUserAction.bind(null, b.user_id)}
              label="Desbloquear"
              pendingLabel="…"
            />
          </div>
        ))}
      </section>
    </>
  );
}
