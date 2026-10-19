# Modelo de Dados — Gearhead

> Status: **rascunho conceitual** (Etapa 0). Nada aqui está implementado. Cada tabela só entra no banco via migração versionada, na etapa em que for realmente necessária.

## Entidades previstas

| Tabela                    | Etapa                | Descrição                                                                                                | Notas de segurança                                                            |
| ------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `profiles`                | 2                    | 1:1 com `auth.users`; apelido, cidade, avatar, `role` (`user`/`admin`).                                  | Usuário edita só o próprio perfil; `role` alterável apenas por admin/serviço. |
| `vehicles`                | 3                    | Veículos do usuário: marca, modelo, ano, apelido, `visibility`.                                          | Dono faz CRUD; público vê só `visibility = 'public'`.                         |
| `vehicle_photos`          | 3                    | Referências a objetos no Storage.                                                                        | Bucket com política por dono; limite de tamanho/MIME.                         |
| `businesses`              | 4                    | Estabelecimentos/profissionais; `location geography(Point)`; `status` (`pending`/`approved`/`rejected`). | Dono não altera `status`/`verified_at`. Índice GiST em `location`.            |
| `specialties`             | 4                    | Catálogo (ex.: injeção eletrônica, suspensão, funilaria).                                                | Leitura pública; escrita admin.                                               |
| `business_specialties`    | 4                    | N:N.                                                                                                     | —                                                                             |
| `credentials`             | 4                    | Documentos enviados para verificação.                                                                    | Bucket privado; só dono e admin leem.                                         |
| `events`                  | 6                    | Eventos com data/hora, local, organizador.                                                               | Constraint `ends_at > starts_at`.                                             |
| `event_attendees`         | 6                    | Presença/confirmação.                                                                                    | Único por (evento, usuário).                                                  |
| `offers`                  | 6                    | Ofertas/cupons de parceiros, validade.                                                                   | Resgate validado no servidor.                                                 |
| `offer_redemptions`       | 6                    | Estado de resgate.                                                                                       | Único conforme regra da oferta.                                               |
| `reviews`                 | 7                    | Avaliações de estabelecimentos.                                                                          | Uma por usuário/estabelecimento.                                              |
| `friendships`             | 7                    | Pedidos e amizades.                                                                                      | —                                                                             |
| `blocks`                  | 7                    | Bloqueios.                                                                                               | Aplicados em políticas RLS de leitura cruzada.                                |
| `reports`                 | 7                    | Denúncias.                                                                                               | Só admin lê todas.                                                            |
| `audit_logs`              | 7                    | Ações administrativas.                                                                                   | Append-only.                                                                  |
| `location_sessions`       | 8                    | Sessão de compartilhamento: finalidade, destinatários, `expires_at`, `revoked_at`.                       | Coordenadas exatas só para destinatários; expiração automática.               |
| `ephemeral_presence`      | 8                    | Presença aproximada (geohash grosseiro), TTL curto.                                                      | Sem histórico permanente.                                                     |
| `challenges`, `check_ins` | pós-MVP              | Navegação, comboio, checkpoints, quiz.                                                                   | Nunca velocidade em via pública.                                              |
| `notifications`           | conforme necessidade | —                                                                                                        | —                                                                             |

## Convenções

- Chaves primárias `uuid` (`gen_random_uuid()`); `created_at`/`updated_at` `timestamptz`.
- Nomes em inglês, `snake_case`; textos de UI em pt-BR.
- RLS habilitada em toda tabela exposta; grants explícitos por operação.
- Seeds somente com dados fictícios.
