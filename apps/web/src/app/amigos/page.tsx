import { listMyBlocks, listMyFriendships, type Friendship } from "@gearhead/shared";
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

export default function FriendsPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Amigos</h1>
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
          <p className="text-muted">
            Visite o perfil de alguém (pelo link /u/nome) para adicionar.
          </p>
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
