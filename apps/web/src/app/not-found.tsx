import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-accent">Erro 404</p>
      <h1 className="text-3xl font-bold tracking-tight">Página não encontrada</h1>
      <p className="text-muted">O endereço não existe ou o conteúdo é privado.</p>
      <Link href="/" className="rounded-lg border border-line px-4 py-2 text-sm font-medium">
        Voltar ao início
      </Link>
    </main>
  );
}
