import { APP_NAME } from "@gearhead/shared";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser, getMyRole } from "@/lib/auth";

const linkClass = "px-2 py-2 text-sm font-medium sm:px-3";

export function SiteHeader() {
  return (
    <header className="border-b border-line">
      <nav
        aria-label="Principal"
        className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 sm:px-8"
      >
        <div className="flex flex-wrap items-center gap-1">
          <Link href="/" className="mr-2 text-lg font-bold tracking-tight">
            {APP_NAME}
          </Link>
          <Link href="/parceiros" className={linkClass}>
            Parceiros
          </Link>
          <Link href="/radar" className={linkClass}>
            Radar
          </Link>
          <Link href="/eventos" className={linkClass}>
            Eventos
          </Link>
          <Link href="/ofertas" className={linkClass}>
            Ofertas
          </Link>
        </div>
        {/* A sessão é lida por requisição; o restante do cabeçalho é estático. */}
        <Suspense fallback={<span className="h-9" aria-hidden />}>
          <AuthNav />
        </Suspense>
      </nav>
    </header>
  );
}

async function AuthNav() {
  const user = await getCurrentUser();

  if (user) {
    // Só controla a exibição do link; /admin e as RPCs verificam o papel no servidor.
    const isAdmin = (await getMyRole()) === "admin";
    return (
      <div className="flex flex-wrap items-center gap-1">
        <Link href="/garagem" className={linkClass}>
          Garagem
        </Link>
        <Link href="/meus-parceiros" className={linkClass}>
          Meu negócio
        </Link>
        {isAdmin && (
          <Link href="/admin" className={`${linkClass} text-accent`}>
            Admin
          </Link>
        )}
        <Link href="/conta" className="rounded-lg border border-line px-4 py-2 text-sm font-medium">
          Minha conta
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link href="/entrar" className={linkClass}>
        Entrar
      </Link>
      <Link
        href="/cadastro"
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        Criar conta
      </Link>
    </div>
  );
}
