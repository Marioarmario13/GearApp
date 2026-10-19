# Roadmap e Backlog — Gearhead

Cada etapa tem um **portão de conclusão**. Não avançar se o portão falhar.

Legenda: ✅ concluído · 🟡 em andamento · ⬜ pendente

## Etapa 0 — Inspeção e plano ✅

- [x] Inspecionar ambiente (Node 24, npm 12, Git, Docker disponíveis; pasta vazia).
- [x] README.md, CLAUDE.md, PRODUCT_REQUIREMENTS, ARCHITECTURE, ROADMAP, DATA_MODEL (rascunho), SECURITY (rascunho).

## Etapa 1 — Fundação técnica ✅

- [x] Monorepo npm workspaces: `apps/web`, `apps/mobile`, `packages/shared`.
- [x] TypeScript strict em todos os workspaces.
- [x] ESLint + Prettier; scripts `lint`, `format`, `format:check`, `typecheck`, `test` na raiz.
- [x] Testes iniciais (Vitest em shared/web, jest-expo em mobile).
- [x] `.env.example`, `.gitignore`, `.editorconfig`, `.nvmrc`.
- [x] CI GitHub Actions (lint, typecheck, test, format:check).
- [x] Git inicializado com primeiro commit.

**Portão:** `npm ci` reproduzível; `npm run verify` passa; README explica como rodar.

## Etapa 2 — Banco e autenticação ⬜

- [ ] Supabase CLI local (Docker); `supabase/migrations` versionadas.
- [ ] Tabela `profiles` (1:1 com `auth.users`), trigger de criação, papel `role` não editável pelo usuário.
- [ ] RLS + grants por operação; testes de acesso permitido/negado (pgTAP ou testes de integração).
- [ ] Cadastro/login no web e mobile.

**Portão:** cadastro/login funcionam e testes comprovam acesso permitido e negado; usuário comum não vira admin.

## Etapa 3 — Garagem ⬜

- [ ] `vehicles` + fotos no Storage com políticas por dono; visibilidade pública/privada.
- [ ] Validação Zod compartilhada (ano, placa opcional, etc.).

**Portão:** usuário só altera seus veículos; testes cobrem as regras. Seeds fictícios.

## Etapa 4 — Parceiros e certificações ⬜

- [ ] `businesses`, `specialties`, `credentials` (documentos privados), fluxo de aprovação.

**Portão:** parceiro pendente não aparece como verificado; administração protegida.

## Etapa 5 — Radar ⬜

- [ ] Comparar provedores de mapa (limites, termos, custo) e registrar decisão.
- [ ] Consultas por raio com PostGIS, indexadas e paginadas; lista + mapa + filtros.

**Portão:** filtros funcionam; buscas usam consultas limitadas e indexadas.

## Etapa 6 — Eventos e benefícios ⬜

- [ ] `events`, `event_attendees`, `offers`, cupons simples com validade e estado de resgate.

**Portão:** datas, regras e estados de resgate validados no servidor.

## Etapa 7 — Comunidade e administração ⬜

- [ ] `friendships`, `blocks`, `reports`, moderação, `audit_logs`.

**Portão:** bloqueios aplicados no backend; ações admin auditadas.

## Etapa 8 — GPS social seguro ⬜

- [ ] `location_sessions`, `ephemeral_presence`; destinatários autorizados; expiração e revogação.

**Portão:** não autorizados não obtêm coordenadas exatas; sessões expiradas param de compartilhar.

## Etapa 9 — Piloto e lançamento ⬜

- [ ] Regressão completa, revisão de privacidade/LGPD, backup, `DEPLOYMENT.md`, `OPERATIONS.md`.

**Portão:** falhas críticas resolvidas; pendências operacionais/jurídicas documentadas. Publicação somente com autorização explícita.
