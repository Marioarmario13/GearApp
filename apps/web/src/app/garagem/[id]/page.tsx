import { getVehicle, signPhotoUrls, vehicleTitle, VISIBILITY_LABELS } from "@gearhead/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  deletePhotoAction,
  deleteVehicleAction,
  updateVehicleAction,
  uploadPhotoAction,
} from "@/app/actions/garage";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { VehicleForm } from "../vehicle-form";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { PhotoUploader } from "./vehicle-controls";

export const metadata: Metadata = { title: "Veículo — Gearhead" };

export default function VehiclePage({ params }: PageProps<"/garagem/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-12">
      <Link href="/garagem" className="text-sm text-muted hover:underline">
        ← Minha garagem
      </Link>
      <Suspense fallback={<p className="text-muted">Carregando veículo…</p>}>
        <VehicleDetails params={params} />
      </Suspense>
    </main>
  );
}

async function VehicleDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();
  // RLS: veículo privado de outra pessoa simplesmente não é retornado → 404.
  const vehicle = await getVehicle(supabase, id);
  if (!vehicle) notFound();

  const isOwner = vehicle.owner_id === user.id;
  const urls = await signPhotoUrls(
    supabase,
    vehicle.photos.map((p) => p.storage_path),
  );

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">{vehicleTitle(vehicle)}</h1>
        <p className="text-muted">
          {vehicle.make} {vehicle.model} · {vehicle.year} · {VISIBILITY_LABELS[vehicle.visibility]}
        </p>
      </header>

      <section aria-labelledby="fotos" className="flex flex-col gap-4">
        <h2 id="fotos" className="text-xl font-semibold">
          Fotos ({vehicle.photos.length})
        </h2>
        {vehicle.photos.length === 0 ? (
          <p className="text-muted">Nenhuma foto ainda.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {vehicle.photos.map((photo, i) => (
              <li key={photo.id} className="relative overflow-hidden rounded-xl border border-line">
                {urls[photo.storage_path] ? (
                  // URL assinada e temporária: otimização do next/image não agrega aqui.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={urls[photo.storage_path]}
                    alt={`Foto ${i + 1} de ${vehicleTitle(vehicle)}`}
                    className="aspect-square w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-square items-center justify-center text-sm text-muted">
                    Indisponível
                  </div>
                )}
                {isOwner && (
                  <form
                    action={deletePhotoAction.bind(null, vehicle.id, photo.id)}
                    className="absolute right-2 top-2"
                  >
                    <button
                      type="submit"
                      className="rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white hover:bg-black"
                      aria-label={`Remover foto ${i + 1}`}
                    >
                      Remover
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
        {isOwner && (
          <PhotoUploader
            action={uploadPhotoAction.bind(null, vehicle.id)}
            photoCount={vehicle.photos.length}
          />
        )}
      </section>

      {isOwner && (
        <>
          <section className="rounded-2xl border border-line bg-surface p-6">
            <h2 className="mb-4 text-xl font-semibold">Dados do veículo</h2>
            <VehicleForm
              action={updateVehicleAction.bind(null, vehicle.id)}
              vehicle={vehicle}
              submitLabel="Salvar alterações"
            />
          </section>
          <section className="rounded-2xl border border-red-300 p-6 dark:border-red-900">
            <h2 className="text-xl font-semibold">Excluir veículo</h2>
            <p className="mt-1 mb-4 text-sm text-muted">
              Remove o veículo, a placa e todas as fotos. Não pode ser desfeito.
            </p>
            <ConfirmActionButton
              action={deleteVehicleAction.bind(null, vehicle.id)}
              confirmText="Excluir este veículo e todas as fotos?"
              label="Excluir veículo"
              pendingLabel="Excluindo…"
            />
          </section>
        </>
      )}
    </>
  );
}
