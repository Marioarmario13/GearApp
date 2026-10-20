# Modelo de Dados — Gearhead

> Status: `profiles` (Etapa 2) e garagem (Etapa 3) **implementadas**; demais tabelas são rascunho conceitual. Cada tabela só entra no banco via migração versionada, na etapa em que for realmente necessária.

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

### Garagem — `supabase/migrations/20261020000100_garage.sql`

**`public.vehicles`**: `id` uuid PK · `owner_id` → `profiles` (default `auth.uid()`, cascade) · `make` (1–60) · `model` (1–80) · `year` smallint (≥ 1886; máximo = ano atual + 1 por trigger) · `nickname` (1–60, nulo) · `visibility` (`public`/`private`, padrão `private`) · `created_at`/`updated_at`.
Índices: `(owner_id, created_at desc)` e parcial em `created_at desc where visibility = 'public'`.
Grants: SELECT colunas; INSERT/UPDATE só `make, model, year, nickname, visibility` (cliente não escolhe `id` nem `owner_id`); DELETE. Policies: SELECT dono ou público; INSERT/UPDATE/DELETE só dono. Trigger: máximo 20 por usuário.

**`public.vehicle_private`**: `vehicle_id` PK/FK (cascade) · `plate` (`^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$`). Policy única: só o dono do veículo (todas as operações).

**`public.vehicle_photos`**: `id` · `vehicle_id` (cascade) · `storage_path` único, formato `<owner>/<vehicle>/<arquivo>.(jpg|jpeg|png|webp)` validado por CHECK + trigger (a pasta tem de ser do dono e do veículo) · máximo 10 por veículo. SELECT se o veículo é visível; INSERT/DELETE só dono.

**Storage `vehicle-photos`**: privado, 5 MB, `image/jpeg|png|webp`. Upload só em `<auth.uid()>/<veículo próprio>/`; leitura pelo dono ou de fotos registradas de veículos públicos; exclusão só na própria pasta.

Helpers (`private`): `owns_vehicle`, `can_view_vehicle`, `owns_vehicle_folder` (valida o caminho sem erro de cast), `validate_vehicle`, `validate_vehicle_photo`.
