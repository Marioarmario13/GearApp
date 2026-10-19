# CLAUDE.md — Gearhead

Instruções permanentes para o Claude Code neste repositório. Revisar e atualizar ao final de cada etapa e sempre que mudarem comandos, estrutura, convenções, dependências, decisões ou riscos. Sem duplicatas nem detalhes temporários.

## Projeto

Plataforma Gearhead (Brasil): site + painel (Next.js) e app Android/iOS (Expo). Diretório de profissionais verificados, garagem virtual, radar (PostGIS), eventos, ofertas, comunidade e, depois, GPS social com consentimento. Requisitos em `docs/PRODUCT_REQUIREMENTS.md`; etapas e portões em `docs/ROADMAP.md`.

**Etapa atual:** 1 concluída → próxima: Etapa 2 (Supabase local, migrações, `profiles`, auth, RLS testada).

## Estrutura

- `apps/web` — `@gearhead/web`, Next.js 16 App Router, Tailwind 4, Vitest + Testing Library. Código em `src/`, alias `@/*`.
- `apps/mobile` — `@gearhead/mobile`, Expo SDK 58, React Native 0.88, Jest (`jest-expo`) + `@testing-library/react-native` 14 (`render` é async → `await render(...)`).
- `packages/shared` — `@gearhead/shared`, Zod 4 + regras puras; consumido como fonte TS (sem build). Web usa `transpilePackages`.
- `docs/` — documentação permanente.

## Comandos (raiz)

```bash
npm install
npm run verify        # format:check + lint + typecheck + test (igual ao CI)
npm run dev:web       # http://localhost:3000
npm run dev:mobile    # Expo
npm run build:web
npm run format        # corrige formatação
npm run test -w @gearhead/shared   # um workspace
```

Dependências: `npm install <pkg> -w <workspace>`. No mobile, use `npx expo install <pkg>` dentro de `apps/mobile` (resolve versões compatíveis com o SDK) e confira com `npx expo install --check`.

## Versões novas — não confiar na memória

- Next.js 16: ler `node_modules/next/dist/docs/` antes de usar APIs (ver `apps/web/AGENTS.md`). `next typegen` gera `LayoutProps`/`PageProps` (já incluído no `typecheck`).
- Expo 58: consultar docs versionadas (ver `apps/mobile/AGENTS.md`).
- TypeScript 6 no mobile: `types` padrão é vazio — tipos globais (ex.: `jest`) precisam estar em `compilerOptions.types`.

## Convenções

- TypeScript strict; `noUncheckedIndexedAccess` em shared e mobile. Sem `any` sem justificativa.
- UI em pt-BR; identificadores de código e banco em inglês (`snake_case` no banco).
- Validação com Zod em `packages/shared`, mas **servidor/RLS é a fonte da verdade** — schema no cliente nunca é a única proteção.
- Testes ao lado do código (`*.test.ts(x)`).
- Prettier: `printWidth` 100, LF. ESLint por workspace (flat config).
- Toda mudança de schema = migração versionada em `supabase/migrations` (a partir da Etapa 2). Seeds só com dados fictícios.

## Regras inegociáveis

- Sem serviços pagos, chaves comerciais, domínios ou cobrança automática. Não publicar/deployar sem autorização explícita.
- `service_role` e segredos nunca no cliente nem no repositório (`.env*` ignorado, exceto `.env.example`).
- Não avançar de etapa se o portão falhar. Não afirmar que testes passaram sem executá-los.
- Sem competição de velocidade em via pública. Localização desligada por padrão (ver `docs/SECURITY.md`).
- Provedor de mapas só após comparação documentada (Etapa 5).

## Rotina após cada tarefa

Revisar diff → `npm run verify` → testes de banco/RLS (Etapa 2+) → regressão → atualizar docs e este arquivo → relatar comandos, resultados reais, limitações e próxima tarefa (declarar "CLAUDE.md revisado/atualizado").

## Riscos e observações conhecidas

- `npm install` bloqueia scripts de `unrs-resolver` e `@parcel/watcher` (política allowScripts do npm 12); lint e testes funcionam sem eles.
- `npm audit --omit=dev` aponta vulnerabilidades transitivas na cadeia de ferramentas do Expo/Metro (`node-forge`, `braces`, `uuid`); Next.js sem achados. Acompanhar patches do Expo SDK; não usar `audit fix --force`. Revisar antes da publicação.
- ESLint 9 (versão gerada pelos templates). Os presets aceitam ESLint 10; migrar só após confirmar compatibilidade dos plugins.
