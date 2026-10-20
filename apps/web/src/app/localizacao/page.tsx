import { getMyLocationSession, listMyFriendships, listSharedWithMe } from "@gearhead/shared";
import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LocationCenter } from "./location-center";

export const metadata: Metadata = { title: "Localização — Gearhead", robots: { index: false } };

export default function LocationPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Localização com amigos</h1>
        <p className="text-muted">
          Desligada por padrão. Você escolhe com quem, por quanto tempo e pode parar a qualquer
          momento.
        </p>
      </header>
      <Suspense fallback={<p className="text-muted">Carregando…</p>}>
        <Center />
      </Suspense>
    </main>
  );
}

async function Center() {
  await requireUser();
  const supabase = await createClient();
  const [links, session, shared] = await Promise.all([
    listMyFriendships(supabase),
    getMyLocationSession(supabase),
    listSharedWithMe(supabase),
  ]);
  return (
    <LocationCenter
      friends={links.filter((f) => f.status === "accepted")}
      session={session}
      shared={shared}
    />
  );
}
