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

## Etapa 2 — Banco e autenticação ✅

- [x] Supabase CLI local (Docker); `supabase/migrations` versionadas.
- [x] Tabela `profiles` (1:1 com `auth.users`), trigger de criação, papel `role` não editável pelo usuário.
- [x] RLS + grants por operação/coluna; 26 testes pgTAP de acesso permitido/negado e escalonamento.
- [x] Cadastro/login no web e mobile; edição de perfil no web.
- [x] CI com job de banco (`db:lint` + `db:test`).
- Pendente para etapas futuras: recuperação de senha, confirmação de e-mail em produção, edição de perfil e avatar no mobile (junto da Garagem).

**Portão:** cadastro/login funcionam e testes comprovam acesso permitido e negado; usuário comum não vira admin.

## Etapa 3 — Garagem ✅

- [x] `vehicles` + `vehicle_private` (placa só do dono) + `vehicle_photos`; bucket privado com políticas por dono; visibilidade pública/privada.
- [x] Limites: 20 veículos/usuário, 10 fotos/veículo, 5 MB, JPG/PNG/WebP.
- [x] Web: `/garagem`, `/garagem/novo`, `/garagem/[id]` (edição, fotos, exclusão; visitantes veem só veículo público).
- [x] Mobile: Expo Router; garagem, cadastro, detalhe com fotos da galeria.
- [x] 35 testes pgTAP novos (61 no total) + 6 testes de integração com API/Storage reais.
- [x] Validação Zod compartilhada (ano, placa opcional, etc.) e camada de dados compartilhada (`garage-data.ts`).
- Pendente: app mobile testado em aparelho real (só testes automatizados e bundle); perfil público com veículos de outros usuários (entra com comunidade); limpeza periódica de arquivos órfãos (Etapa 9).

**Portão:** usuário só altera seus veículos; testes cobrem as regras. Seeds fictícios.

## Etapa 4 — Parceiros e certificações ✅

- [x] `businesses`, `specialties` (catálogo de 18), `business_specialties`, `credentials` (documentos privados), fluxo de aprovação.
- [x] Aprovação exige documento de registro (CNPJ/MEI) conferido; certificações públicas só após conferência individual.
- [x] `audit_logs` antecipada da Etapa 7: toda decisão admin é registrada (quem, quando, o quê).
- [x] Web: diretório público com filtros e paginação, área do dono, painel `/admin` com fila e histórico.
- [x] Mobile: diretório e detalhe (somente leitura).
- [x] 57 testes pgTAP novos (118 no total) + 9 testes de integração com API/Storage reais + fluxo completo validado no navegador.
- Pendente: cadastro de parceiro e conferência pelo app (hoje só no site); localização/raio (Etapa 5); notificar o dono quando houver decisão (sem provedor de e-mail no custo zero).
- Decisão: ordem ajustada — `audit_logs` entrou aqui porque a aprovação de parceiros precisa ser auditável desde o início.

**Portão:** parceiro pendente não aparece como verificado; administração protegida.

## Etapa 5 — Radar ✅

- [x] Comparar provedores de mapa (limites, termos, custo) e registrar decisão — [`docs/MAPS.md`](./MAPS.md): OpenFreeMap + MapLibre; Google/Mapbox/MapTiler/OSM tiles rejeitados (faturamento, uso comercial ou política de uso).
- [x] Consultas por raio com PostGIS (`ST_DWithin`, índice GiST parcial verificado por EXPLAIN), raio ≤100 km e ≤50 resultados; lista + mapa + filtros (tipo, especialidade, raio).
- [x] Pin manual do estabelecimento no mapa (sem geocodificação externa), auditado.
- [x] Web `/radar` e mapa na página do parceiro; app com tela Radar (WebView, Expo Go) e mapa no detalhe.
- [x] 26 testes pgTAP novos (144 no total) + 4 de integração + verificação no navegador.
- Pendente: testar o mapa e a permissão de localização num celular real; agrupamento de marcadores quando houver muitos parceiros; avaliar busca por cidade → coordenada (exigiria geocodificação com cache/proxy).

**Portão:** filtros funcionam; buscas usam consultas limitadas e indexadas.

## Etapa 6 — Eventos e benefícios ✅

- [x] `events` (datas validadas no servidor, até 7 dias, capacidade, local no mapa, cancelamento pelo organizador, remoção auditada por admin), `event_attendees` (RPC com bloqueio de vaga), `offers` e `coupons` (emissão/resgate/cancelamento por RPC, limites por pessoa e total, vencimento).
- [x] Web: `/eventos`, `/eventos/novo`, `/eventos/[id]` (presença, painel do organizador, moderação), `/eventos/meus`, `/ofertas`, `/ofertas/[id]`, `/meus-cupons`; ofertas e validação de cupom em `/meus-parceiros/[id]`.
- [x] Mobile: eventos (lista, detalhe, presença, mapa), ofertas (lista, detalhe, pegar cupom) e meus cupons.
- [x] 47 testes pgTAP novos (191 no total) + integração repetível + fluxo validado no navegador.
- Pendente: notificações (lembrete de evento, cupom perto de vencer) — exigem provedor de push/e-mail; criação de eventos e gestão de ofertas pelo app (hoje no site).

**Portão:** datas, regras e estados de resgate validados no servidor.

## Etapa 7 — Comunidade e administração ✅

- [x] `friendships` (RPCs, pedido cruzado vira amizade, limite diário), `blocks` (aplicados em perfis, veículos/fotos, amizade e presença em eventos; bloqueado não é avisado), `reports` (limite diário, sem duplicata aberta), moderação (ocultar veículo, remover evento, suspender parceiro) e `audit_logs` (já desde a Etapa 4).
- [x] Web: perfil público `/u/[username]` (garagem pública, amizade, bloquear, denunciar), `/amigos`, botão Denunciar em veículo/parceiro/evento/oferta, `/admin/denuncias` e `/admin/auditoria`.
- [x] Mobile: tela de amigos (pedidos, amigos, bloqueados) e denúncia em parceiro e evento.
- [x] 32 testes pgTAP novos (223 no total) + integração repetível.
- Pendente: suspensão de conta de usuário (exige operação de servidor com chave de serviço — Etapa 9); busca de pessoas por nome (hoje pelo link do perfil).

**Portão:** bloqueios aplicados no backend; ações admin auditadas.

## Etapa 8 — GPS social seguro ✅

- [x] `location_sessions` + `location_session_recipients` (finalidade, amigos sem bloqueio, 5 min–8 h, revogação imediata, expiração pelo relógio do banco, só a última posição, limpeza a cada acesso, mínimo de 30 s entre atualizações) e `ephemeral_presence` (opt-in até 2 h, célula de ~5,5 km, só faixas de distância para amigos).
- [x] Bloquear encerra o compartilhamento entre os dois; nenhuma tabela legível diretamente.
- [x] Web `/localizacao` (envio a cada 60 s só com a página aberta) e tela no app (expo-location em primeiro plano).
- [x] 31 testes pgTAP novos (254 no total) cobrindo abuso, enumeração, bloqueio, revogação e expiração + integração + verificação no navegador.
- Pendente: agendar `purge_expired_locations()` em produção (pg_cron ou função agendada); testar em aparelho real.

**Portão:** não autorizados não obtêm coordenadas exatas; sessões expiradas param de compartilhar.

## Etapa 9 — Piloto e lançamento ✅

- [x] Regressão completa (unitários, 267 pgTAP, integração repetível com API/Storage, build web, bundle Android) local e no CI.
- [x] Revisão de privacidade/LGPD ([`PRIVACY.md`](./PRIVACY.md)) com exportação de dados e exclusão de conta implementadas (13 pgTAP + integração).
- [x] Revisão de segurança: nenhum segredo versionado, cabeçalhos HTTP de segurança, auditoria de dependências (sem críticas).
- [x] [`DEPLOYMENT.md`](./DEPLOYMENT.md) (passos, sem publicar), [`OPERATIONS.md`](./OPERATIONS.md) (moderação, limpezas, backup, incidentes) e [`PILOT_CHECKLIST.md`](./PILOT_CHECKLIST.md) com pendências técnicas, operacionais e jurídicas.
- ⬜ Teste em aparelho real (combinado com o responsável para o fim do projeto).

**Portão:** falhas críticas resolvidas; pendências operacionais/jurídicas documentadas. Publicação somente com autorização explícita.
