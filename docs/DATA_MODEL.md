# Modelo de Dados — Gearhead

> Status: `profiles` **implementada** (Etapa 2); demais tabelas são rascunho conceitual. Cada tabela só entra no banco via migração versionada, na etapa em que for realmente necessária.

## Implementado

### `public.profiles` — `supabase/migrations/20261019000100_profiles.sql`

| Coluna                     | Tipo                        | Regras                                                        |
| -------------------------- | --------------------------- | ------------------------------------------------------------- |
| `id`                       | `uuid` PK                   | FK `auth.users(id)` `on delete cascade`                       |
| `username`                 | `text` unique, nulo         | `^[a-z0-9_]{3,30}$`                                           |
| `display_name`             | `text`                      | 1–60 caracteres após trim                                     |
| `city`                     | `text`                      | 1–80 caracteres                                               |
| `state`                    | `char(2)`                   | UF brasileira válida                                          |
| `avatar_url`               | `text`                      | até 500 caracteres (upload real na Etapa 3)                   |
| `role`                     | `app_role` (`user`/`admin`) | padrão `user`; **sem grant de leitura/escrita para clientes** |
| `created_at`, `updated_at` | `timestamptz`               | `updated_at` por trigger                                      |

- Criado pelo trigger `on_auth_user_created` (`private.handle_new_user`): username/display_name vêm do metadata do cadastro; inválido ou duplicado vira `NULL` sem bloquear o cadastro.
- Grants: `authenticated` → `SELECT` em colunas públicas, `UPDATE (username, display_name, city, state, avatar_url)`. `anon` → nada. Sem `INSERT`/`DELETE` para clientes.
- Policies: `SELECT` para autenticados; `UPDATE` só onde `id = auth.uid()`.
- RPCs: `current_user_role()` (próprio papel), `set_user_role(uuid, app_role)` (apenas admin). Helper `private.is_admin()`.

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
