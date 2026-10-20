# CLAUDE.md — Gearhead

Instruções permanentes para o Claude Code neste repositório. Revisar e atualizar ao final de cada etapa e sempre que mudarem comandos, estrutura, convenções, dependências, decisões ou riscos. Sem duplicatas nem detalhes temporários.

## Projeto

Plataforma Gearhead (Brasil): site + painel (Next.js) e app Android/iOS (Expo). Diretório de profissionais verificados, garagem virtual, radar (PostGIS), eventos, ofertas, comunidade e, depois, GPS social com consentimento. Requisitos em `docs/PRODUCT_REQUIREMENTS.md`; etapas e portões em `docs/ROADMAP.md`.

**Etapa atual:** 4 concluída (parceiros, credenciais, aprovação admin auditada) → próxima: Etapa 5 (Radar: comparar provedores de mapa antes de codar).

## Estrutura

- `apps/web` — `@gearhead/web`, Next.js 16 App Router, Tailwind 4, Vitest + Testing Library. Código em `src/`, alias `@/*`.
- `apps/mobile` — `@gearhead/mobile`, Expo SDK 58, React Native 0.88, **Expo Router** (rotas em `src/app/`, telas em `src/screens/`, alias `@/*` → `src/`), Jest (`jest-expo`) + `@testing-library/react-native` 14.
- `packages/shared` — `@gearhead/shared`, Zod 4, regras puras, tipos gerados do banco (`database.types.ts`, via `npm run db:types` — nunca editar à mão) e camada de dados compartilhada (`data-core.ts` com erros/helpers, `garage-data.ts`, `partner-data.ts`: funções que recebem o cliente Supabase do chamador). Consumido como fonte TS (sem build). Web usa `transpilePackages`.
- `supabase/` — `config.toml`, `migrations/` (SQL versionado), `seed.sql` (fictício), `tests/database/*.test.sql` (pgTAP).
- `docs/` — documentação permanente.

## Auth e acesso a dados

- Web: `src/proxy.ts` renova a sessão (cookies, `@supabase/ssr`) e faz redirecionamentos otimistas; **autorização real** em `src/lib/auth.ts` (`getCurrentUser`/`requireUser`, via `getUser()`) + RLS. Toda Server Action chama `requireUser()` de novo.
- Web: `src/lib/supabase/server.ts` chama `await connection()` antes de criar o cliente — obrigatório com Cache Components (o SDK usa `Date.now()`). Componentes que leem sessão ficam dentro de `<Suspense>`.
- Mobile: `src/lib/supabase.ts` (sessão em `expo-sqlite/localStorage`, auto-refresh por `AppState`). Testes de UI mockam esse módulo.
- `profiles.role` não é legível nem editável pelo cliente: grants por coluna. Papel do usuário atual via RPC `current_user_role()`; troca de papel só por `set_user_role()` (admin). Selecione colunas explícitas — `select=*`/`return=representation` em `profiles` falha (42501) por causa de `role`.
- `auto_expose_new_tables = false`: toda tabela nova precisa de `grant` explícito na migração, além de RLS e policies por operação.
- Helpers internos de RLS ficam no schema `private` (não exposto pela API).
- Garagem: dado sensível do veículo (placa) fica em `vehicle_private`, só o dono lê. Fotos no bucket **privado** `vehicle-photos` em `<owner_id>/<vehicle_id>/<arquivo>`; exibição só por URL assinada (10 min). Terceiros só leem fotos de veículos públicos.
- Sem `upsert` em tabelas com grants por coluna: `ON CONFLICT DO UPDATE` exige UPDATE em todas as colunas inseridas (inclusive FKs). Use update-ou-insert.
- Excluir veículo: remover arquivos do Storage **antes** da linha (SQL não apaga objetos do Storage; `deleteVehicle` já faz isso).
- Parceiros: nascem `pending`; só `review_business()` (admin) muda status, e aprovar **exige** credencial `business_registration` aprovada. Mudar nome/tipo de parceiro aprovado volta para `pending`. Ações admin gravam `audit_logs` via `private.audit()`. Documentos no bucket privado `business-documents` (dono + admin); arquivo de credencial aprovada não pode ser apagado pelo dono. Nota de revisão e caminho do documento só via RPCs `get_business_review`/`get_business_credentials`.
- Erros de regra de negócio no SQL: `raise ... using errcode = 'GH001'` com mensagem pt-BR; `dataErrorMessage()` exibe direto.
- **Policies nunca podem referenciar colunas sem grant para o papel** (ex.: `credentials.document_path`): o Postgres checa permissões de todas as policies ao planejar e o erro 42501 quebra operações não relacionadas (aconteceu com deletes do Storage). Use função `security definer` em `private`.
- Web: rotas `/parceiros` (público), `/meus-parceiros` (dono), `/admin` (admin; `requireAdmin()` devolve 404 a não-admins). Uploads via Server Action (`bodySizeLimit` 10.5mb em `next.config.ts`). Mobile: `expo-image-picker` + `expo-image-manipulator` (converte para JPEG ≤1600 px).

## Comandos (raiz)

```bash
npm install
npm run verify        # format:check + lint + typecheck + test (igual ao CI)
npm run dev:web       # http://localhost:3000
npm run dev:mobile    # Expo
npm run build:web
npm run format        # corrige formatação
npm run test -w @gearhead/shared   # um workspace
npm run db:start      # Supabase local (Docker Desktop precisa estar aberto)
npm run db:test       # testes pgTAP (RLS, grants, constraints)
npm run db:lint       # lint do schema
npm run db:reset      # recria o banco local: migrações + seed (APAGA dados locais)
npm run db:new <nome> # nova migração
npm run db:status     # URLs e chaves locais
npm run db:types      # regenera packages/shared/src/database.types.ts (após cada migração)
npm run test:integration  # testes do shared contra API/Storage locais (precisa de db:start)
```

Usuários do seed (local): `admin@gearhead.test` e `piloto@gearhead.test` — senha em `supabase/seed.sql`. O seed também cria 2 parceiros do piloto (1 aprovado, 1 pendente); o limite é 3 por usuário, então os testes de integração que criam parceiro dependem de não sobrar lixo de execuções anteriores.

Portas locais do Supabase: **443xx** (API `http://127.0.0.1:44321`, Studio 44323, Mailpit 44324). As padrão 543xx caíam na faixa que o Windows/Hyper-V reserva a cada boot (`netsh interface ipv4 show excludedportrange protocol=tcp`).

Dependências: `npm install <pkg> -w <workspace>`. No mobile, use `npx expo install <pkg>` dentro de `apps/mobile` (resolve versões compatíveis com o SDK) e confira com `npx expo install --check`.

## Versões novas — não confiar na memória

- Next.js 16: ler `node_modules/next/dist/docs/` antes de usar APIs (ver `apps/web/AGENTS.md`). `next typegen` gera `LayoutProps`/`PageProps` (já incluído no `typecheck`).
- Expo 58: consultar docs versionadas (ver `apps/mobile/AGENTS.md`).
- `@testing-library/react-native` 14: `render` e `fireEvent` são async → sempre `await`.
- Testes do mobile: mockar `@/lib/supabase` com `src/test-utils/supabase-mock.ts`; `expo-router` e `@/auth/AuthProvider` são mockados por arquivo.
- Next 16 mantém páginas anteriores ocultas no DOM (preservação de estado): em testes de navegador, filtre elementos visíveis.
- Navegador embutido com a janela do app minimizada: `requestAnimationFrame` não dispara e o React não revela conteúdo de `<Suspense>` (fica no fallback). Contorno para testes: substituir `requestAnimationFrame` por `setTimeout` na página e navegar com `window.next.router.push()` (sem recarregar).
- TypeScript 6 no mobile: `types` padrão é vazio — tipos globais (ex.: `jest`) precisam estar em `compilerOptions.types`.

## Convenções

- TypeScript strict; `noUncheckedIndexedAccess` em shared e mobile. Sem `any` sem justificativa.
- UI em pt-BR; identificadores de código e banco em inglês (`snake_case` no banco).
- Validação com Zod em `packages/shared`, mas **servidor/RLS é a fonte da verdade** — schema no cliente nunca é a única proteção.
- Testes ao lado do código (`*.test.ts(x)`).
- Prettier: `printWidth` 100, LF. ESLint por workspace (flat config).
- Toda mudança de schema = migração versionada em `supabase/migrations` (aplicar com `npx supabase migration up`, sem apagar dados locais) + `npm run db:types` + testes pgTAP cobrindo SELECT/INSERT/UPDATE/DELETE para anon, dono, não dono e admin (+ políticas de Storage quando houver arquivos). Seeds só com dados fictícios. Constraints do banco espelham os schemas Zod de `packages/shared`.

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
- Mensagens de erro do Supabase passam por `authErrorMessage()` (shared) para não vazar detalhes internos na UI.
- No celular físico com Expo Go, `EXPO_PUBLIC_SUPABASE_URL` precisa usar o IP da máquina na rede, não `127.0.0.1`.
- ESLint 9 (versão gerada pelos templates). Os presets aceitam ESLint 10; migrar só após confirmar compatibilidade dos plugins.
