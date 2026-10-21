# Checklist do piloto — Gearhead

Estado em **2026-10-20**. Legenda: ✅ feito · ⬜ pendente · ⚖️ jurídico · 💰 pode gerar custo (decisão do responsável).

## Qualidade e segurança (feito)

- ✅ Regressão completa: format, lint, typecheck, testes unitários (shared, web, mobile), 284 testes pgTAP de banco (RLS, grants, constraints, abuso) e testes de integração contra API/Storage reais — também no CI.
- ✅ RLS em todas as tabelas; nenhuma tabela nova exposta sem grant explícito.
- ✅ Bloqueios aplicados no banco; moderação auditada.
- ✅ Localização: desligada por padrão, efêmera, sem histórico, só para amigos escolhidos.
- ✅ Direitos do titular: exportar dados e excluir conta.
- ✅ Cabeçalhos HTTP de segurança no site.
- ✅ Nenhum segredo no repositório; apenas chaves publishable nos apps.

## Pendências técnicas

- ⬜ **Teste em aparelho real** (Android e iOS) com Expo Go: login, garagem com fotos da galeria, radar/mapa na WebView, eventos, cupons, amigos e localização. Pendente desde a Etapa 3, combinado para o fim do projeto.
- ⬜ Suspensão de conta de usuário pela interface admin (hoje pelo painel do Supabase).
- ⬜ Notificações (pedidos de amizade, lembretes de evento, cupom vencendo) — 💰 provedor de push/e-mail.
- ⬜ Recuperação de senha pela interface (fluxo do Supabase Auth + e-mail) — 💰 SMTP.
- ✅ Busca de pessoas por nome ou @usuário (site em `/amigos`, app na tela de amigos; respeita bloqueios, 3–30 caracteres, até 20 resultados).
- ✅ Agrupamento de marcadores no mapa (site e app; tocar no grupo aproxima).
- ✅ Fotos enviadas pelo site são reprocessadas no servidor (sem EXIF/GPS, lado maior ≤1600 px).
- ✅ Limpeza de localizações agendada (pg_cron, 10 min) e listagem de arquivos órfãos (`private.orphan_storage_objects()`). ⬜ Remoção dos órfãos segue manual (ver `OPERATIONS.md`).
- ⬜ Avaliar migração do mapa do app para SDK nativo (exige development build).
- ⬜ Vulnerabilidades moderadas/altas transitivas no ferramental Expo/React Native (sem críticas; Next.js sem achados) — acompanhar atualizações do SDK.

## Pendências operacionais

- ⬜ Responsável operacional e escala de moderação.
- ⬜ 💰 Contas de produção (Supabase, hospedagem, Expo/EAS, lojas) — ver `DEPLOYMENT.md`.
- ⬜ Monitoramento de cotas e plano de saída dos mapas.

## Pendências jurídicas ⚖️

- ⬜ Termos de uso e política de privacidade; aceite no cadastro.
- ⬜ Encarregado (DPO) e canal do titular.
- ⬜ Bases legais e RIPD da localização compartilhada.
- ⬜ Prazos de retenção (auditoria, documentos de parceiros, denúncias).
- ⬜ Regras para menores de idade.
- ⬜ Responsabilidade sobre ofertas/cupons de parceiros e sobre eventos (avisos de segurança já exibidos).

**Publicação: somente com autorização explícita do responsável.**
