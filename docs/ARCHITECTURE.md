# Arquitetura — Gearhead

> Status: Etapa 8 (GPS social seguro). Atualizar sempre que a implementação mudar.

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

| #   | Decisão                                                               | Motivo                                                                                                                          | Alternativas descartadas                                                |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| D1  | Monorepo com **npm workspaces**                                       | Já vem com o Node; sem ferramenta extra; compatível com Expo/Metro sem configurações especiais de symlink.                      | pnpm (exige `node-linker=hoisted` para Expo), Turborepo/Nx (prematuro). |
| D2  | **Next.js (App Router) + TypeScript** em `apps/web`                   | Site indexável e painel admin na mesma aplicação.                                                                               | Vite SPA (pior SEO).                                                    |
| D3  | **Expo + TypeScript** em `apps/mobile`                                | Uma base Android/iOS; Expo Go para testes locais sem custo.                                                                     | React Native CLI puro (mais configuração nativa).                       |
| D4  | **`packages/shared`** com Zod e regras puras                          | Mesma validação no cliente e no servidor; regras testáveis sem UI. O servidor continua sendo a fonte da verdade.                | Duplicar validação por app.                                             |
| D5  | **Supabase** (Postgres + PostGIS + Auth + Storage)                    | Free tier + execução local via Docker para testes de banco/RLS.                                                                 | Backend próprio (mais infraestrutura).                                  |
| D6  | **Vitest** em `shared` e `web`; **Jest (jest-expo)** em `mobile`      | Vitest é rápido para TS puro; jest-expo é o caminho oficial para RN.                                                            | Um único runner para tudo (RN com Vitest não é suportado oficialmente). |
| D7  | ESLint por workspace (flat config) + **Prettier** na raiz             | Cada framework tem preset próprio (next, expo); formatação única.                                                               | —                                                                       |
| D8  | Mapas: **OpenFreeMap + MapLibre GL JS** (web direto; app via WebView) | Sem chave, sem faturamento, uso comercial permitido, roda no Expo Go; provedor trocável pela URL do estilo. Ver `docs/MAPS.md`. | Google Maps, Mapbox, MapTiler Free, tiles do OSM.                       |

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

## Garagem (Etapa 3)

- Camada de dados em `packages/shared/src/garage-data.ts`, usada por web (Server Actions/Server Components) e mobile (telas). Cada função recebe o cliente Supabase **autenticado do chamador** — a autorização continua no banco.
- Tipos do banco gerados em `packages/shared/src/database.types.ts`; clientes tipados com `SupabaseClient<Database>`.
- Fotos: o web envia o arquivo para uma Server Action, que faz o upload com a sessão do usuário; o mobile escolhe na galeria, converte para JPEG e envia direto ao Storage. Exibição por URLs assinadas.
- O mobile passou a usar **Expo Router** com `Stack.Protected` (guarda de navegação; dados protegidos pela RLS).
- Testes em camadas: pgTAP (RLS/Storage), integração do shared contra o Supabase local (`npm run test:integration`, também no CI), unitários (Vitest/Jest) e verificação manual no navegador.

## Parceiros e conferência (Etapa 4)

```
Dono ──► /meus-parceiros ──► businesses (pending) + credentials (pending) + arquivo no bucket privado
Admin ─► /admin ──► review_credential() ──► review_business() ──► audit_logs
                         (exige registro conferido para aprovar)
Público ► /parceiros (site) e app ──► só businesses approved + credentials approved (RLS)
```

- Camada de dados em `packages/shared/src/partner-data.ts`; base comum (erros, URLs assinadas) em `data-core.ts`.
- Regras críticas ficam no banco (triggers e RPCs `security definer`); a UI só reflete. Erros de regra usam SQLSTATE `GH001` com mensagem pt-BR.
- Mobile: diretório e detalhe somente leitura; cadastro e conferência pelo site.

## Radar (Etapa 5)

```
Usuário ──(toca "usar minha localização")──► posição arredondada (~1 km) no aparelho
   └─► web: Server Action searchRadarAction ─┐
   └─► app: supabase.rpc direto ─────────────┴─► search_nearby_businesses() ─► PostGIS (GiST)
Mapa: MapLibre GL JS + tiles OpenFreeMap (web: componente MapView; app: WebView com o mesmo estilo)
Dono ─► pin no mapa ─► set_business_location() ─► businesses.location (+ auditoria)
```

- Lógica e tipos em `packages/shared/src/radar.ts` (`searchNearby`, `setBusinessLocation`, `coarsenCoordinate`, `formatDistance`).
- Web: `src/components/map/` (`MapView` + `LazyMapView`), `/radar`, mapa na página do parceiro e seletor de pin em `/meus-parceiros/[id]`.
- Mobile: `src/screens/RadarScreen.tsx`, `src/components/MapWebView.tsx`, `src/lib/map-html.ts`, `src/lib/location.ts`.

## Eventos e benefícios (Etapa 6)

- `packages/shared/src/events.ts` e `offers.ts`: schemas (datas em horário de Brasília) e acesso a dados.
- Regras críticas em RPCs `security definer` com `select … for update` (capacidade de evento, limites de cupom).
- Web: Server Actions em `src/app/actions/events.ts` e `offers.ts`; seletor de local reutilizável em `src/components/map/location-picker.tsx`.
- Mobile: `src/screens/EventsScreens.tsx` e `OffersScreens.tsx` (criação de eventos e gestão de ofertas ficam no site).

## Comunidade (Etapa 7)

- `packages/shared/src/community.ts`: amizades, bloqueios, denúncias e funções de moderação.
- Regra de ouro: **bloqueio é verificado no banco** (policies + RPCs). A interface só oculta botões por conveniência.
- Web: `src/app/actions/community.ts`, componentes `ReportButton` e `ActionButton` (`src/components/community.tsx`), páginas `/u/[username]`, `/amigos`, `/admin/denuncias`, `/admin/auditoria`.
- Mobile: `src/screens/CommunityScreens.tsx` (amigos e `ReportSection`).

## GPS social (Etapa 8)

```
Dono ──(abre sessão: finalidade + amigos + prazo)──► start_location_session()
  └─ tela aberta: posição a cada 60 s ──► update_session_location()  (banco ignora < 30 s; guarda só a última)
Destinatário ──► shared_locations_for_me()  (só sessão ativa + amizade + sem bloqueio)
Revogar/expirar ──► coordenada apagada (limpeza também a cada acesso)
Presença ──► set_presence() (célula ~5,5 km) ──► nearby_friends() (faixas de distância)
```

- `packages/shared/src/social-gps.ts`; web `src/app/localizacao/` + `src/app/actions/social-gps.ts`; mobile `src/screens/LocationScreen.tsx` (expo-location em primeiro plano).
