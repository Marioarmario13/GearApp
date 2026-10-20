import { APP_NAME } from "@gearhead/shared";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";

export function SiteHeader() {
  return (
    <header className="border-b border-line">
      <nav
        aria-label="Principal"
        className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-8"
      >
        <Link href="/" className="text-lg font-bold tracking-tight">
          {APP_NAME}
        </Link>
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
    return (
      <Link href="/conta" className="rounded-lg border border-line px-4 py-2 text-sm font-medium">
        Minha conta
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link href="/entrar" className="px-3 py-2 text-sm font-medium">
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
