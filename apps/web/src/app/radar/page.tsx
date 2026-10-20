import { listSpecialties } from "@gearhead/shared";
import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { RadarExplorer } from "./radar-explorer";

export const metadata: Metadata = {
  title: "Radar — Gearhead",
  description: "Encontre oficinas, preparadores e serviços verificados perto de você.",
};

export default function RadarPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-12 sm:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Radar</h1>
        <p className="max-w-2xl text-muted">
          Parceiros verificados perto de você ou de qualquer ponto do mapa.
        </p>
      </header>
      <Suspense fallback={<p className="text-muted">Carregando…</p>}>
        <Radar />
      </Suspense>
    </main>
  );
}

async function Radar() {
  const specialties = await listSpecialties(await createClient());
  return <RadarExplorer specialties={specialties} />;
}
