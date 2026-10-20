import { listMyVehicles, signPhotoUrls, vehicleTitle, VISIBILITY_LABELS } from "@gearhead/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Minha garagem — Gearhead" };

export default function GaragePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-12 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Minha garagem</h1>
        <Link
          href="/garagem/novo"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Adicionar veículo
        </Link>
      </div>
      <Suspense fallback={<p className="text-muted">Carregando veículos…</p>}>
        <VehicleList />
      </Suspense>
    </main>
  );
}

async function VehicleList() {
  const user = await requireUser();
  const supabase = await createClient();
  const vehicles = await listMyVehicles(supabase, user.id);

  if (vehicles.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line p-10 text-center">
        <p className="text-lg font-semibold">Sua garagem está vazia</p>
        <p className="mt-1 text-muted">Cadastre seu primeiro veículo para começar.</p>
      </div>
    );
  }

  const covers = vehicles.flatMap((v) => (v.photos[0] ? [v.photos[0].storage_path] : []));
  const urls = await signPhotoUrls(supabase, covers);

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {vehicles.map((v) => {
        const cover = v.photos[0] && urls[v.photos[0].storage_path];
        return (
          <li key={v.id}>
            <Link
              href={`/garagem/${v.id}`}
              className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-accent"
            >
              <div className="aspect-video bg-background">
                {cover ? (
                  // URL assinada e temporária: otimização do next/image não agrega aqui.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cover} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted">
                    Sem foto
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1 p-4">
                <p className="font-semibold">{vehicleTitle(v)}</p>
                <p className="text-sm text-muted">
                  {v.make} {v.model} · {v.year}
                </p>
                <p className="text-xs font-medium uppercase tracking-wider text-muted">
                  {VISIBILITY_LABELS[v.visibility]} · {v.photos.length} foto(s)
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
