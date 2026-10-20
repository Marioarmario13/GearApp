import {
  getProfileByUsername,
  listMyFriendships,
  listPublicVehicles,
  signPhotoUrls,
  vehicleTitle,
} from "@gearhead/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  blockUserAction,
  removeFriendshipAction,
  respondFriendRequestAction,
  sendFriendRequestAction,
} from "@/app/actions/community";
import { ActionButton, ReportButton } from "@/components/community";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Perfil — Gearhead", robots: { index: false } };

export default function ProfilePage({ params }: PageProps<"/u/[username]">) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-12">
      <Suspense fallback={<p className="text-muted">Carregando perfil…</p>}>
        <Profile params={params} />
      </Suspense>
    </main>
  );
}

async function Profile({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const user = await requireUser();
  const supabase = await createClient();
  // RLS: perfil some se houver bloqueio entre os dois (em qualquer direção).
  const profile = await getProfileByUsername(supabase, decodeURIComponent(username).toLowerCase());
  if (!profile) notFound();

  const isMe = profile.id === user.id;
  const [vehicles, friendships] = await Promise.all([
    listPublicVehicles(supabase, profile.id),
    isMe ? Promise.resolve([]) : listMyFriendships(supabase),
  ]);
  const link = friendships.find((f) => f.other_id === profile.id);
  const covers = await signPhotoUrls(
    supabase,
    vehicles.flatMap((v) => (v.photos[0] ? [v.photos[0].storage_path] : [])),
  );
  const path = `/u/${profile.username}`;

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {profile.display_name ?? "Sem nome"}
          </h1>
          <p className="text-muted">
            @{profile.username}
            {profile.city ? ` · ${profile.city}${profile.state ? `/${profile.state}` : ""}` : ""}
          </p>
        </div>
        {isMe ? (
          <Link
            href="/conta"
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium"
          >
            Editar perfil
          </Link>
        ) : (
          <div className="flex flex-wrap items-start gap-2">
            {!link && (
              <ActionButton
                action={sendFriendRequestAction.bind(null, profile.id, path)}
                label="Adicionar amigo"
                pendingLabel="Enviando…"
                variant="primary"
              />
            )}
            {link?.status === "pending" && link.incoming && (
              <ActionButton
                action={respondFriendRequestAction.bind(null, link.friendship_id, true)}
                label="Aceitar amizade"
                pendingLabel="Aceitando…"
                variant="primary"
              />
            )}
            {link?.status === "pending" && !link.incoming && (
              <ActionButton
                action={removeFriendshipAction.bind(null, link.friendship_id, path)}
                label="Cancelar pedido"
                pendingLabel="Cancelando…"
              />
            )}
            {link?.status === "accepted" && (
              <ActionButton
                action={removeFriendshipAction.bind(null, link.friendship_id, path)}
                label="Desfazer amizade"
                pendingLabel="Removendo…"
                confirmText="Desfazer a amizade?"
              />
            )}
            <ActionButton
              action={blockUserAction.bind(null, profile.id, "/amigos")}
              label="Bloquear"
              pendingLabel="Bloqueando…"
              confirmText="Bloquear esta pessoa? Vocês deixam de ver o perfil e os veículos um do outro."
              variant="danger"
            />
          </div>
        )}
      </header>

      <section aria-labelledby="garagem" className="flex flex-col gap-3">
        <h2 id="garagem" className="text-xl font-semibold">
          Garagem pública ({vehicles.length})
        </h2>
        {vehicles.length === 0 ? (
          <p className="text-muted">Nenhum veículo público.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vehicles.map((v) => {
              const cover = v.photos[0] && covers[v.photos[0].storage_path];
              return (
                <li key={v.id}>
                  <Link
                    href={`/garagem/${v.id}`}
                    className="block overflow-hidden rounded-2xl border border-line bg-surface hover:border-accent"
                  >
                    <div className="aspect-video bg-background">
                      {cover ? (
                        // URL assinada e temporária.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cover} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-muted">
                          Sem foto
                        </div>
                      )}
                    </div>
                    <p className="p-3 font-semibold">{vehicleTitle(v)}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {!isMe && <ReportButton targetType="profile" targetId={profile.id} />}
    </>
  );
}
