# Operação — Gearhead

Rotinas para o piloto. Responsável operacional: **[definir]**.

## Rotina diária

- **Fila de conferência** (`/admin`): parceiros e documentos pendentes. Abrir cada documento (link de 5 min), conferir dados de registro (CNPJ/MEI) e registrar a decisão com observação. Nunca aprovar sem ver o documento.
- **Denúncias** (`/admin/denuncias`): analisar, agir (ocultar veículo, remover evento, suspender parceiro) e resolver/arquivar com nota. Prioridade: `dangerous_driving`, `fraud` e `privacy`.
- **Auditoria** (`/admin/auditoria`): revisar ações administrativas do dia.

## Rotina semanal

- Uso e cotas no painel do Supabase (banco, Storage, Auth, egress) e da hospedagem. Agir antes de 80% de qualquer limite gratuito.
- Disponibilidade dos mapas (OpenFreeMap). Se houver instabilidade, seguir o plano de saída de [`MAPS.md`](./MAPS.md).
- `npm audit --omit=dev` e atualizações de segurança do Expo/Next/Supabase (sem `audit fix --force`).

## Limpezas

| O quê                             | Como                                                                                                    | Frequência          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------- |
| Posições de localização expiradas | `private.purge_expired_locations()` — agendado no `pg_cron` (`purge-expired-locations`) e a cada acesso | A cada 10 min       |
| Arquivos órfãos no Storage        | `select * from private.orphan_storage_objects();` no editor SQL; remover pela API/painel do Storage     | Mensal              |
| Contas excluídas                  | Automático (cascata); confirmar ausência de arquivos remanescentes                                      | Mensal (amostragem) |

Conferir os jobs: `select jobname, schedule, active from cron.job;` e falhas recentes em `cron.job_run_details` (histórico podado após 7 dias).

## Backup e restauração

- Verificar a política de backup do plano do Supabase (frequência e retenção).
- Exportação lógica periódica (fora do plano gratuito, se necessário): `npx supabase db dump --linked -f backup.sql` em ambiente seguro, **criptografado**, com acesso restrito. Não guardar backups em repositório.
- Testar uma restauração em projeto de teste a cada trimestre.

## Incidentes

1. **Conter**: revogar chaves expostas no painel (gerar novas publishable/secret), desativar a funcionalidade afetada, ocultar conteúdo.
2. **Avaliar**: o que vazou, quantos titulares, desde quando (auditoria, logs do Supabase).
3. **Comunicar**: responsável jurídico; ANPD e titulares quando houver risco relevante (LGPD art. 48) — **[JURÍDICO]** definir prazos e modelo.
4. **Corrigir e registrar**: migração com correção + teste pgTAP que reproduz o problema; nota em `SECURITY.md`.

## Moderação — orientações

- Velocidade em via pública, racha ou direção perigosa: remover/ocultar e registrar motivo.
- Exposição de dados pessoais (placas, endereços de terceiros): remover.
- Parceiro com documento falso: suspender (`review_business` → `suspended`) e recusar o documento com motivo.
- Suspensão de **conta de usuário**: `/admin/usuarios` (busca, suspender e reativar, sempre com motivo auditado) ou direto da denúncia de perfil em `/admin/denuncias`. Suspender encerra as sessões e a localização, recusa novo login e bloqueia a API. Para suspender um admin, remover antes o papel (`set_user_role`). Pedidos de titular (LGPD) de conta suspensa chegam pelo canal do encarregado.
