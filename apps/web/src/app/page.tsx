import { APP_NAME } from "@gearhead/shared";

const MODULES = [
  {
    title: "Garagem",
    description: "Cadastre seus veículos, fotos e escolha o que fica público.",
  },
  {
    title: "Profissionais verificados",
    description: "Mecânicos, oficinas e preparadores com credenciais conferidas.",
  },
  {
    title: "Radar",
    description: "Encontre serviços, postos parceiros e eventos perto de você.",
  },
  {
    title: "Eventos e benefícios",
    description: "Encontros automotivos, confirmações de presença e cupons de parceiros.",
  },
] as const;

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-4 py-16 sm:px-8">
      <header className="flex flex-col gap-4">
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">
          Em desenvolvimento
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{APP_NAME}</h1>
        <p className="max-w-2xl text-lg text-muted">
          A plataforma para quem vive o mundo automotivo no Brasil: garagem virtual, profissionais
          de confiança, eventos e comunidade.
        </p>
      </header>

      <section aria-labelledby="modulos" className="flex flex-col gap-6">
        <h2 id="modulos" className="text-2xl font-semibold">
          O que está chegando
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {MODULES.map((m) => (
            <li key={m.title} className="rounded-xl border border-line bg-surface p-6">
              <h3 className="text-lg font-semibold">{m.title}</h3>
              <p className="mt-2 text-muted">{m.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
