import { listMyBusinesses } from "@gearhead/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createEventAction } from "@/app/actions/events";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EventForm } from "../event-form";

export const metadata: Metadata = { title: "Criar evento — Gearhead" };

export default function NewEventPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-12">
      <Link href="/eventos" className="text-sm text-muted hover:underline">
        ← Eventos
      </Link>
      <h1 className="text-3xl font-bold tracking-tight">Criar evento</h1>
      <section className="rounded-2xl border border-line bg-surface p-6">
        <Suspense fallback={<p className="text-muted">Carregando…</p>}>
          <Form />
        </Suspense>
      </section>
      <p className="text-sm text-muted">Depois de criar, você pode marcar o local no mapa.</p>
    </main>
  );
}

async function Form() {
  const user = await requireUser();
  const businesses = await listMyBusinesses(await createClient(), user.id);
  const hosts = businesses
    .filter((b) => b.status === "approved")
    .map((b) => ({ value: b.id, label: b.name }));
  return <EventForm action={createEventAction} hostOptions={hosts} submitLabel="Criar evento" />;
}
