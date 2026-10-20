# Arquitetura — Gearhead

> Status: Etapa 2 (banco e autenticação). Atualizar sempre que a implementação mudar.

## Visão geral

```
                 ┌────────────────────┐      ┌────────────────────┐
                 │  apps/web          │      │  apps/mobile       │
                 │  Next.js (App      │      │  Expo / React      │
                 │  Router) — site +  │      │  Native (Android/  │
                 │  painel admin      │      │  iOS)              │
                 └─────────┬──────────┘      └─────────┬──────────┘
                           │   importam                │
                           └──────────┬────────────────┘
                                      ▼
                         ┌────────────────────────┐
                         │ packages/shared        │
                         │ Zod schemas, tipos,    │
                         │ regras de domínio puras│
                         └────────────────────────┘
                                      │ (Etapa 2+)
                                      ▼
                 ┌──────────────────────────────────────────┐
                 │ Supabase: Postgres + PostGIS, Auth,      │
                 │ Storage, RLS. Migrações em supabase/     │
                 └──────────────────────────────────────────┘
```

## Decisões

| #   | Decisão                                                          | Motivo                                                                                                           | Alternativas descartadas                                                |
| --- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| D1  | Monorepo com **npm workspaces**                                  | Já vem com o Node; sem ferramenta extra; compatível com Expo/Metro sem configurações especiais de symlink.       | pnpm (exige `node-linker=hoisted` para Expo), Turborepo/Nx (prematuro). |
| D2  | **Next.js (App Router) + TypeScript** em `apps/web`              | Site indexável e painel admin na mesma aplicação.                                                                | Vite SPA (pior SEO).                                                    |
| D3  | **Expo + TypeScript** em `apps/mobile`                           | Uma base Android/iOS; Expo Go para testes locais sem custo.                                                      | React Native CLI puro (mais configuração nativa).                       |
| D4  | **`packages/shared`** com Zod e regras puras                     | Mesma validação no cliente e no servidor; regras testáveis sem UI. O servidor continua sendo a fonte da verdade. | Duplicar validação por app.                                             |
| D5  | **Supabase** (Postgres + PostGIS + Auth + Storage)               | Free tier + execução local via Docker para testes de banco/RLS.                                                  | Backend próprio (mais infraestrutura).                                  |
| D6  | **Vitest** em `shared` e `web`; **Jest (jest-expo)** em `mobile` | Vitest é rápido para TS puro; jest-expo é o caminho oficial para RN.                                             | Um único runner para tudo (RN com Vitest não é suportado oficialmente). |
| D7  | ESLint por workspace (flat config) + **Prettier** na raiz        | Cada framework tem preset próprio (next, expo); formatação única.                                                | —                                                                       |
| D8  | Provedor de mapas **ainda não escolhido**                        | Prompt exige comparar limites/termos/custos antes (Etapa 5).                                                     | —                                                                       |

## Camadas

- **UI** (`apps/*`): componentes e telas. Sem regra de negócio crítica.
- **Domínio** (`packages/shared`): schemas Zod, tipos, funções puras (ex.: validade de cupom, formatação de placa).
- **Persistência/autorização** (`supabase/`, Etapa 2+): migrações SQL versionadas, RLS, funções RPC. Toda regra crítica é aplicada aqui.

## Pacote compartilhado

`@gearhead/shared` é consumido como código-fonte TypeScript (sem build separado):

- Web: `transpilePackages: ["@gearhead/shared"]` em `next.config.ts`.
- Mobile: Metro resolve o workspace via `node_modules` (hoisted pelo npm).

## Variáveis de ambiente

Ver `.env.example` na raiz e em cada app. Somente chaves **públicas** (`NEXT_PUBLIC_*`, `EXPO_PUBLIC_*`) vão para o cliente. `service_role` nunca entra em código cliente.

## Autenticação (Etapa 2)

```
Navegador ──► proxy.ts (renova cookies de sessão; redireciona /conta ↔ /entrar)
          ──► Server Component / Server Action
                └─ lib/auth.ts: requireUser() → supabase.auth.getUser()
                └─ consultas com o JWT do usuário → Postgres aplica RLS + grants
App mobile ──► supabase-js (sessão em expo-sqlite/localStorage) → mesma API, mesmas policies
```

- Web usa `@supabase/ssr` com cookies; mobile usa `@supabase/supabase-js` direto.
- Ambos usam apenas a chave **publishable**. Nenhum código cliente usa `service_role`.
- Rotas web: `/cadastro`, `/entrar`, `/conta` (protegida). Mobile: tela de login/cadastro e tela de conta (sem roteador ainda; Expo Router entra quando houver mais telas).
- Testes: pgTAP (`supabase/tests/database`) cobre o banco; Vitest cobre helpers web/shared; Jest cobre telas do mobile com o cliente Supabase mockado; fluxo web completo validado manualmente no navegador contra o Supabase local.
