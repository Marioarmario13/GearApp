# Modelo de Dados — Gearhead

> Status: `profiles` (Etapa 2), garagem (3), parceiros (4), radar (5), eventos/benefícios (6) e comunidade (7) **implementados**; demais tabelas são rascunho conceitual. Cada tabela só entra no banco via migração versionada, na etapa em que for realmente necessária.

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

| Tabela                    | Etapa                | Descrição                                                                          | Notas de segurança                                                            |
| ------------------------- | -------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `profiles`                | 2                    | 1:1 com `auth.users`; apelido, cidade, avatar, `role` (`user`/`admin`).            | Usuário edita só o próprio perfil; `role` alterável apenas por admin/serviço. |
| `vehicles`                | 3                    | Veículos do usuário: marca, modelo, ano, apelido, `visibility`.                    | Dono faz CRUD; público vê só `visibility = 'public'`.                         |
| `vehicle_photos`          | 3                    | Referências a objetos no Storage.                                                  | Bucket com política por dono; limite de tamanho/MIME.                         |
| `businesses`              | 4 (+5 localização)   | Implementada (ver abaixo). `location geography(Point)` entra na Etapa 5.           | Índice GiST em `location` na Etapa 5.                                         |
| `specialties`             | 4                    | Catálogo (ex.: injeção eletrônica, suspensão, funilaria).                          | Leitura pública; escrita admin.                                               |
| `business_specialties`    | 4                    | N:N.                                                                               | —                                                                             |
| `credentials`             | 4                    | Documentos enviados para verificação.                                              | Bucket privado; só dono e admin leem.                                         |
| `events`                  | 6                    | Eventos com data/hora, local, organizador.                                         | Constraint `ends_at > starts_at`.                                             |
| `event_attendees`         | 6                    | Presença/confirmação.                                                              | Único por (evento, usuário).                                                  |
| `offers`                  | 6                    | Ofertas/cupons de parceiros, validade.                                             | Resgate validado no servidor.                                                 |
| `offer_redemptions`       | 6                    | Estado de resgate.                                                                 | Único conforme regra da oferta.                                               |
| `reviews`                 | 7                    | Avaliações de estabelecimentos.                                                    | Uma por usuário/estabelecimento.                                              |
| `friendships`             | 7                    | Pedidos e amizades.                                                                | —                                                                             |
| `blocks`                  | 7                    | Bloqueios.                                                                         | Aplicados em políticas RLS de leitura cruzada.                                |
| `reports`                 | 7                    | Denúncias.                                                                         | Só admin lê todas.                                                            |
| `audit_logs`              | 4 (antecipada)       | Implementada (ver abaixo).                                                         | Append-only.                                                                  |
| `location_sessions`       | 8                    | Sessão de compartilhamento: finalidade, destinatários, `expires_at`, `revoked_at`. | Coordenadas exatas só para destinatários; expiração automática.               |
| `ephemeral_presence`      | 8                    | Presença aproximada (geohash grosseiro), TTL curto.                                | Sem histórico permanente.                                                     |
| `challenges`, `check_ins` | pós-MVP              | Navegação, comboio, checkpoints, quiz.                                             | Nunca velocidade em via pública.                                              |
| `notifications`           | conforme necessidade | —                                                                                  | —                                                                             |

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

### Parceiros — `supabase/migrations/20261021000100_partners.sql`

**`public.businesses`**: `id` · `owner_id` (default `auth.uid()`) · `kind` (`workshop`, `mechanic`, `tuner`, `gas_station`, `parts_store`, `detailing`) · `name` (2–80) · `description` (≤1000) · `phone` (10–11 dígitos) · `phone_is_whatsapp` · `email` · `website` (http/https) · `street`, `street_number`, `district` · `city`, `state` (UF) obrigatórios · `postal_code` (8 dígitos) · `status` (`pending`/`approved`/`rejected`/`suspended`) · `review_note`, `reviewed_by`, `reviewed_at` · timestamps.
Grants: público lê colunas sem `review_note`/`reviewed_by`; dono insere/atualiza só dados cadastrais. Policies: anônimo vê `approved`; autenticado vê `approved`, os próprios e (admin) todos. Triggers: força `pending` na criação; máx. 3 por usuário; nome/tipo alterado em aprovado → `pending` + auditoria.

**`public.specialties`**: catálogo (`id` slug, `name`, `sort`), leitura pública, mantido por migração. **`public.business_specialties`**: N:N, máx. 15 por parceiro, visível quando o parceiro é visível.

**`public.credentials`**: `business_id` · `type` (`business_registration`, `certification`, `training`, `other`) · `title` · `issuer` · `specialty_id` · `issued_on`/`expires_on` · `document_path` (`<owner>/<business>/<arquivo>.(pdf|jpg|jpeg|png|webp)`) · `status` (`pending`/`approved`/`rejected`) · revisão. Público vê só aprovadas de parceiros visíveis, sem `document_path`/`review_note`. Sem UPDATE para clientes (trocar = excluir e reenviar). Máx. 20 por parceiro.

**`public.audit_logs`**: `actor_id`, `action`, `entity_type`, `entity_id`, `details` jsonb, `created_at`. Sem grants de escrita; inserção só por `private.audit()` (security definer). Leitura só admin.

**RPCs**: `get_business_review(id)` e `get_business_credentials(id)` (dono/admin); `review_credential(id, decisão, nota)` e `review_business(id, decisão, nota)` (admin; motivo obrigatório para recusar/suspender; aprovar exige registro conferido; recusar o registro de um aprovado o devolve para `pending`).

**Storage `business-documents`**: privado, 10 MB, PDF/JPG/PNG/WebP. Upload na pasta do próprio parceiro; leitura dono ou admin; exclusão pelo dono só de arquivos sem credencial aprovada (`private.is_approved_document`).

### Radar — `supabase/migrations/20261022000100_radar.sql`

- Extensão `postgis` no schema `extensions`.
- `businesses.location geography(Point, 4326)` (constraint: dentro da caixa aproximada do Brasil) + colunas geradas `latitude`/`longitude` (legíveis). Índice GiST parcial `businesses_location_gist` (`where status = 'approved'`).
- `set_business_location(id, lat, lng)`: só o dono; `null` remove; arredonda para ~1 m; grava `business.location_changed` na auditoria.
- `search_nearby_businesses(lat, lng, raio_km, tipo, especialidade, limite)`: pública (anon/autenticado), security definer com filtro `status = 'approved'`, raio 1–100 km, máximo de 50 resultados, ordenada por distância; devolve `distance_m` e `specialty_ids`.

### Eventos e benefícios — `supabase/migrations/20261023000100_events_offers.sql`

**`public.events`**: organizador (`auth.uid()`), parceiro anfitrião opcional (precisa ser do organizador e aprovado), `kind` (`meetup`, `exhibition`, `cruise`, `track_day`, `workshop`, `charity`, `other`), título, descrição, `starts_at`/`ends_at` (início futuro, fim após início, até 7 dias), local (nome, endereço, cidade, UF obrigatórios; `location` opcional com lat/lng geradas), `capacity` (1–10.000), `attendee_count` (gatilho), `status` (`scheduled`/`cancelled`/`removed`) e `status_note`. Máx. 10 eventos futuros por organizador. Evento encerrado não é editável.

**`public.event_attendees`** (evento, usuário): inserção só por `rsvp_event()`; o usuário remove a própria presença. Leitura: o próprio, o organizador e admins.

**`public.offers`**: parceiro, título, `discount_label`, descrição, regras, `starts_at`/`ends_at` (até 1 ano), `max_redemptions`, `per_user_limit` (1–10), `issued_count`, `status` (`active`/`paused`). Pública só se ativa, vigente e de parceiro aprovado. Máx. 20 vigentes por parceiro; não pode ser excluída depois de emitir cupons.

**`public.coupons`**: oferta, usuário, `code` (8 caracteres sem ambíguos, único), `status` (`issued`/`redeemed`/`cancelled`), `expires_at` = fim da oferta. Sem escrita direta: `claim_offer()`, `redeem_coupon()` (dono do parceiro), `cancel_coupon()` (cliente, só emitido). Leitura: cliente, dono do parceiro e admin.

**RPCs**: `rsvp_event`, `cancel_event`, `remove_event` (admin, auditado), `set_event_location`, `get_event_attendees`, `claim_offer`, `cancel_coupon`, `redeem_coupon`.

### Comunidade — `supabase/migrations/20261024000100_community.sql`

**`public.blocks`** (bloqueador, bloqueado): cada um lê só os próprios bloqueios; escrita por `block_user()`/`unblock_user()`. Helpers `private.blocked_with(outro)` e `private.blocked_between(a, b)`; policies de `profiles` e `vehicles` e as funções `can_view_vehicle` e `rsvp_event` foram atualizadas para respeitar bloqueios.

**`public.friendships`**: `requester_id`, `addressee_id`, `status` (`pending`/`accepted`), índice único por par (independe de quem pediu). Escrita por `send_friend_request()` (limite de 30 por dia; pedido cruzado vira amizade) e `respond_friend_request()`; qualquer um dos dois pode excluir. Leitura: participantes; nomes via `my_friendships()`.

**`public.reports`**: `target_type` (`profile`/`vehicle`/`business`/`event`/`offer`), `target_id`, `reason` (`spam`, `offensive`, `fraud`, `dangerous_driving`, `privacy`, `other`), `details`, `status` (`open`/`resolved`/`dismissed`), resolução. Único aberto por denunciante+alvo; máximo de 20 por dia. Leitura: o próprio denunciante e admins. `resolve_report()` e `moderate_hide_vehicle()` (admin, auditados); fila em `admin_list_reports()`.
