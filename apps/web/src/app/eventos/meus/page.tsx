import { listMyEvents, listMyRsvps } from "@gearhead/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EventCard } from "@/components/events";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Meus eventos — Gearhead" };

export default function MyEventsPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-12 sm:px-8">
      <Link href="/eventos" className="text-sm text-muted hover:underline">
        ← Eventos
      </Link>
      <h1 className="text-3xl font-bold tracking-tight">Meus eventos</h1>
      <Suspense fallback={<p className="text-muted">Carregando…</p>}>
        <Lists />
      </Suspense>
    </main>
  );
}

async function Lists() {
  const user = await requireUser();
  const supabase = await createClient();
  const [organized, going] = await Promise.all([
    listMyEvents(supabase, user.id),
    listMyRsvps(supabase, user.id),
  ]);
  const section = (title: string, items: typeof organized, empty: string) => (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="text-muted">{empty}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {items.map((ev) => (
            <li key={ev.id}>
              <EventCard event={ev} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
  return (
    <>
      {section("Vou participar", going, "Você ainda não confirmou presença em eventos.")}
      {section("Organizados por mim", organized, "Você ainda não organizou eventos.")}
    </>
  );
}
