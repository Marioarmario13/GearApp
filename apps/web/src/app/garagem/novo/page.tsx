import type { Metadata } from "next";
import Link from "next/link";
import { createVehicleAction } from "@/app/actions/garage";
import { VehicleForm } from "../vehicle-form";

export const metadata: Metadata = { title: "Novo veículo — Gearhead" };

export default function NewVehiclePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <Link href="/garagem" className="text-sm text-muted hover:underline">
        ← Minha garagem
      </Link>
      <h1 className="text-3xl font-bold tracking-tight">Novo veículo</h1>
      <section className="rounded-2xl border border-line bg-surface p-6">
        <VehicleForm action={createVehicleAction} submitLabel="Cadastrar veículo" />
      </section>
      <p className="text-sm text-muted">Depois de cadastrar, você poderá adicionar fotos.</p>
    </main>
  );
}
