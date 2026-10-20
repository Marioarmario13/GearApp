import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/actions/auth";
import { getMyProfile, getMyRole, requireUser } from "@/lib/auth";
import { PrivacySection } from "./privacy-section";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Minha conta — Gearhead" };

export default function AccountPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Minha conta</h1>
      <Suspense fallback={<p className="text-muted">Carregando seu perfil…</p>}>
        <AccountContent />
      </Suspense>
    </main>
  );
}

async function AccountContent() {
  const user = await requireUser();
  const [profile, role] = await Promise.all([getMyProfile(user.id), getMyRole()]);

  if (!profile) {
    return (
      <p role="alert" className="text-red-600">
        Perfil não encontrado. Saia e entre novamente; se persistir, contate o suporte.
      </p>
    );
  }

  return (
    <>
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-6">
        <div>
          <p className="font-semibold">{profile.display_name ?? "Sem nome"}</p>
          <p className="text-sm text-muted">{user.email}</p>
          {profile.username && (
            <Link href={`/u/${profile.username}`} className="text-sm text-accent hover:underline">
              Ver meu perfil público
            </Link>
          )}
          {role === "admin" && (
            <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-accent">
              Administrador
            </p>
          )}
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-background"
          >
            Sair
          </button>
        </form>
      </section>

      {!profile.username && (
        <p
          role="status"
          className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          Escolha um nome de usuário para completar seu perfil.
        </p>
      )}

      <section className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="mb-4 text-xl font-semibold">Perfil</h2>
        <ProfileForm profile={profile} />
      </section>

      <PrivacySection />
    </>
  );
}
