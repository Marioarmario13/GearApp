-- Etapa 6: eventos (com confirmação de presença) e benefícios (ofertas e cupons simples).
--
-- Regras:
--  * Evento: datas validadas no servidor (início no futuro, fim após início, até 7 dias),
--    capacidade opcional garantida com bloqueio de linha, cancelamento só pelo organizador,
--    remoção só por admin (auditada). Sem competição de velocidade: track_day apenas em
--    pista/autódromo (o local é obrigatório para todo evento).
--  * Presença: só pela RPC rsvp_event (evento agendado, não encerrado, com vaga).
--    Lista de presentes visível só ao próprio usuário, ao organizador e a admins;
--    o público vê apenas o total (attendee_count, mantido por gatilho).
--  * Oferta: criada pelo dono do parceiro; só aparece se o parceiro está aprovado, a oferta
--    está ativa e dentro da validade. Sem carteira financeira: cupom é um código de desconto.
--  * Cupom: emitido e resgatado só por RPCs (claim_offer / redeem_coupon), com limites
--    por usuário e total verificados no servidor sob bloqueio; resgate só pelo dono do parceiro.

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.event_kind as enum
  ('meetup', 'exhibition', 'cruise', 'track_day', 'workshop', 'charity', 'other');
create type public.event_status as enum ('scheduled', 'cancelled', 'removed');
create type public.offer_status as enum ('active', 'paused');
create type public.coupon_status as enum ('issued', 'redeemed', 'cancelled');

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete set null,
  kind public.event_kind not null,
  title text not null constraint events_title_length check (char_length(btrim(title)) between 3 and 120),
  description text constraint events_description_length check (char_length(description) <= 2000),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  venue_name text not null constraint events_venue_length check (char_length(btrim(venue_name)) between 2 and 120),
  street text constraint events_street_length check (char_length(btrim(street)) between 1 and 120),
  street_number text constraint events_number_length check (char_length(btrim(street_number)) between 1 and 20),
  district text constraint events_district_length check (char_length(btrim(district)) between 1 and 80),
  city text not null constraint events_city_length check (char_length(btrim(city)) between 1 and 80),
  state char(2) not null constraint events_state_uf check (
    state in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
              'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')
  ),
  location extensions.geography(Point, 4326),
  latitude double precision generated always as (extensions.st_y(location::extensions.geometry)) stored,
  longitude double precision generated always as (extensions.st_x(location::extensions.geometry)) stored,
  capacity integer constraint events_capacity_range check (capacity between 1 and 10000),
  attendee_count integer not null default 0,
  status public.event_status not null default 'scheduled',
  status_note text constraint events_status_note_length check (char_length(status_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_dates check (ends_at > starts_at and ends_at <= starts_at + interval '7 days'),
  constraint events_location_brazil check (
    location is null or (
      extensions.st_x(location::extensions.geometry) between -74.5 and -28.0
      and extensions.st_y(location::extensions.geometry) between -34.5 and 6.0
    )
  )
);

create index events_upcoming_idx on public.events (starts_at) where status = 'scheduled';
create index events_place_idx on public.events (state, city, starts_at) where status = 'scheduled';
create index events_organizer_idx on public.events (organizer_id, starts_at desc);
create index events_location_gist on public.events using gist (location) where status = 'scheduled';

create trigger events_set_updated_at
  before update on public.events
  for each row execute function private.set_updated_at();

create function private.validate_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'scheduled';
    new.status_note := null;
    new.attendee_count := 0;
    if new.starts_at <= now() then
      raise exception 'O evento precisa começar no futuro' using errcode = 'GH001';
    end if;
    if (select count(*) from public.events e
        where e.organizer_id = new.organizer_id and e.status = 'scheduled' and e.ends_at > now()) >= 10 then
      raise exception 'Limite de 10 eventos futuros por organizador atingido' using errcode = 'GH001';
    end if;
  else
    -- Mudanças de status passam só pelas RPCs (que ajustam a variável abaixo).
    if old.ends_at <= now() and current_setting('gearhead.event_admin_change', true) is distinct from 'on' then
      raise exception 'Evento já encerrado não pode ser alterado' using errcode = 'GH001';
    end if;
    if new.starts_at is distinct from old.starts_at and new.starts_at <= now() then
      raise exception 'O evento precisa começar no futuro' using errcode = 'GH001';
    end if;
    if new.capacity is not null and new.capacity < new.attendee_count then
      raise exception 'A capacidade não pode ser menor que o número de confirmados' using errcode = 'GH001';
    end if;
  end if;

  if new.business_id is not null and (tg_op = 'INSERT' or new.business_id is distinct from old.business_id) then
    if not exists (
      select 1 from public.businesses b
      where b.id = new.business_id and b.owner_id = new.organizer_id and b.status = 'approved'
    ) then
      raise exception 'O parceiro anfitrião precisa ser seu e estar verificado' using errcode = 'GH001';
    end if;
  end if;
  return new;
end;
$$;

create trigger events_validate
  before insert or update on public.events
  for each row execute function private.validate_event();

create function private.owns_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.events e where e.id = p_event_id and e.organizer_id = (select auth.uid())
  );
$$;

revoke all on function private.owns_event(uuid) from public;
grant execute on function private.owns_event(uuid) to authenticated;

alter table public.events enable row level security;
revoke all on table public.events from anon, authenticated;

grant select (id, organizer_id, business_id, kind, title, description, starts_at, ends_at, venue_name,
              street, street_number, district, city, state, latitude, longitude, capacity,
              attendee_count, status, status_note, created_at, updated_at)
  on table public.events to anon, authenticated;
grant insert (business_id, kind, title, description, starts_at, ends_at, venue_name,
              street, street_number, district, city, state, capacity)
  on table public.events to authenticated;
grant update (business_id, kind, title, description, starts_at, ends_at, venue_name,
              street, street_number, district, city, state, capacity)
  on table public.events to authenticated;

create policy "events_select_anon"
  on public.events for select
  to anon
  using (status <> 'removed');

create policy "events_select_authenticated"
  on public.events for select
  to authenticated
  using (status <> 'removed' or organizer_id = (select auth.uid()) or private.is_admin());

create policy "events_insert_own"
  on public.events for insert
  to authenticated
  with check (organizer_id = (select auth.uid()));

create policy "events_update_own_scheduled"
  on public.events for update
  to authenticated
  using (organizer_id = (select auth.uid()) and status = 'scheduled')
  with check (organizer_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- event_attendees
-- ---------------------------------------------------------------------------
create table public.event_attendees (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index event_attendees_user_idx on public.event_attendees (user_id, created_at desc);

-- Mantém o total público de confirmados.
create function private.sync_attendee_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('gearhead.event_admin_change', 'on', true);
  if tg_op = 'INSERT' then
    update public.events set attendee_count = attendee_count + 1 where id = new.event_id;
  else
    update public.events set attendee_count = greatest(attendee_count - 1, 0) where id = old.event_id;
  end if;
  perform set_config('gearhead.event_admin_change', 'off', true);
  return null;
end;
$$;

create trigger event_attendees_count
  after insert or delete on public.event_attendees
  for each row execute function private.sync_attendee_count();

alter table public.event_attendees enable row level security;
revoke all on table public.event_attendees from anon, authenticated;
grant select on table public.event_attendees to authenticated;
grant delete on table public.event_attendees to authenticated;

create policy "event_attendees_select_own_or_organizer"
  on public.event_attendees for select
  to authenticated
  using (user_id = (select auth.uid()) or private.owns_event(event_id) or private.is_admin());

-- Desistir: o próprio usuário remove a confirmação (antes do fim do evento).
create policy "event_attendees_delete_own"
  on public.event_attendees for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- RPCs de eventos
-- ---------------------------------------------------------------------------
create function public.rsvp_event(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Entre para confirmar presença' using errcode = '42501';
  end if;

  -- Bloqueia a linha do evento: evita ultrapassar a capacidade em confirmações simultâneas.
  select * into v_event from public.events where id = p_event_id for update;
  if not found or v_event.status = 'removed' then
    raise exception 'Evento não encontrado' using errcode = 'P0002';
  end if;
  if v_event.status = 'cancelled' then
    raise exception 'Este evento foi cancelado' using errcode = 'GH001';
  end if;
  if v_event.ends_at <= now() then
    raise exception 'Este evento já terminou' using errcode = 'GH001';
  end if;
  if exists (select 1 from public.event_attendees a where a.event_id = p_event_id and a.user_id = v_uid) then
    return v_event.attendee_count;
  end if;
  if v_event.capacity is not null and v_event.attendee_count >= v_event.capacity then
    raise exception 'Não há mais vagas neste evento' using errcode = 'GH001';
  end if;

  insert into public.event_attendees (event_id, user_id) values (p_event_id, v_uid);
  return v_event.attendee_count + 1;
end;
$$;

create function public.cancel_event(p_event_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.owns_event(p_event_id) then
    raise exception 'Evento não encontrado' using errcode = 'P0002';
  end if;
  update public.events
     set status = 'cancelled', status_note = nullif(btrim(p_note), '')
   where id = p_event_id and status = 'scheduled';
  if not found then
    raise exception 'Só é possível cancelar eventos agendados' using errcode = 'GH001';
  end if;
end;
$$;

create function public.remove_event(p_event_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Apenas administradores podem remover eventos' using errcode = '42501';
  end if;
  if char_length(coalesce(btrim(p_note), '')) < 5 then
    raise exception 'Explique o motivo (mínimo de 5 caracteres)' using errcode = 'GH001';
  end if;
  perform set_config('gearhead.event_admin_change', 'on', true);
  update public.events set status = 'removed', status_note = btrim(p_note) where id = p_event_id;
  perform set_config('gearhead.event_admin_change', 'off', true);
  if not found then
    raise exception 'Evento não encontrado' using errcode = 'P0002';
  end if;
  perform private.audit('event.removed', 'event', p_event_id, jsonb_build_object('note', btrim(p_note)));
end;
$$;

create function public.set_event_location(
  p_event_id uuid,
  p_latitude double precision default null,
  p_longitude double precision default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.owns_event(p_event_id) then
    raise exception 'Evento não encontrado' using errcode = 'P0002';
  end if;
  if (p_latitude is null) <> (p_longitude is null) then
    raise exception 'Informe latitude e longitude' using errcode = 'GH001';
  end if;
  if p_latitude is not null and (p_latitude not between -34.5 and 6.0 or p_longitude not between -74.5 and -28.0) then
    raise exception 'A localização precisa estar no Brasil' using errcode = 'GH001';
  end if;
  update public.events
     set location = case when p_latitude is null then null else
           extensions.st_setsrid(extensions.st_makepoint(
             round(p_longitude::numeric, 5)::float8, round(p_latitude::numeric, 5)::float8), 4326
           )::extensions.geography end
   where id = p_event_id;
end;
$$;

-- Lista de confirmados com nome público — só para o organizador (ou admin).
create function public.get_event_attendees(p_event_id uuid)
returns table (user_id uuid, username text, display_name text, confirmed_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select a.user_id, p.username, p.display_name, a.created_at
  from public.event_attendees a
  join public.profiles p on p.id = a.user_id
  where a.event_id = p_event_id and (private.owns_event(p_event_id) or private.is_admin())
  order by a.created_at;
$$;

revoke all on function
  public.rsvp_event(uuid), public.cancel_event(uuid, text), public.remove_event(uuid, text),
  public.set_event_location(uuid, double precision, double precision), public.get_event_attendees(uuid)
  from public, anon;
grant execute on function
  public.rsvp_event(uuid), public.cancel_event(uuid, text), public.remove_event(uuid, text),
  public.set_event_location(uuid, double precision, double precision), public.get_event_attendees(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- offers
-- ---------------------------------------------------------------------------
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  title text not null constraint offers_title_length check (char_length(btrim(title)) between 3 and 120),
  description text constraint offers_description_length check (char_length(description) <= 1000),
  discount_label text not null constraint offers_discount_length check (char_length(btrim(discount_label)) between 2 and 60),
  terms text constraint offers_terms_length check (char_length(terms) <= 1000),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  max_redemptions integer constraint offers_max_redemptions_range check (max_redemptions between 1 and 100000),
  per_user_limit smallint not null default 1 constraint offers_per_user_range check (per_user_limit between 1 and 10),
  issued_count integer not null default 0,
  status public.offer_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offers_dates check (ends_at > starts_at and ends_at <= starts_at + interval '1 year')
);

create index offers_business_idx on public.offers (business_id, created_at desc);
create index offers_live_idx on public.offers (ends_at) where status = 'active';

create trigger offers_set_updated_at
  before update on public.offers
  for each row execute function private.set_updated_at();

create function private.validate_offer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.issued_count := 0;
    if new.ends_at <= now() then
      raise exception 'A validade da oferta precisa terminar no futuro' using errcode = 'GH001';
    end if;
    if (select count(*) from public.offers o
        where o.business_id = new.business_id and o.ends_at > now()) >= 20 then
      raise exception 'Limite de 20 ofertas vigentes por parceiro atingido' using errcode = 'GH001';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.max_redemptions is not null and new.max_redemptions < old.issued_count then
      raise exception 'O limite total não pode ser menor que os cupons já emitidos' using errcode = 'GH001';
    end if;
  elsif tg_op = 'DELETE' then
    if old.issued_count > 0 then
      raise exception 'Oferta com cupons emitidos não pode ser excluída; pause-a' using errcode = 'GH001';
    end if;
    return old;
  end if;
  return new;
end;
$$;

create trigger offers_validate
  before insert or update or delete on public.offers
  for each row execute function private.validate_offer();

create function private.owns_offer(p_offer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.offers o join public.businesses b on b.id = o.business_id
    where o.id = p_offer_id and b.owner_id = (select auth.uid())
  );
$$;

revoke all on function private.owns_offer(uuid) from public;
grant execute on function private.owns_offer(uuid) to authenticated;

alter table public.offers enable row level security;
revoke all on table public.offers from anon, authenticated;

grant select (id, business_id, title, description, discount_label, terms, starts_at, ends_at,
              max_redemptions, per_user_limit, issued_count, status, created_at, updated_at)
  on table public.offers to anon, authenticated;
grant insert (business_id, title, description, discount_label, terms, starts_at, ends_at,
              max_redemptions, per_user_limit)
  on table public.offers to authenticated;
grant update (title, description, discount_label, terms, starts_at, ends_at,
              max_redemptions, per_user_limit, status)
  on table public.offers to authenticated;
grant delete on table public.offers to authenticated;

-- Visível ao público: ativa, ainda vigente e de parceiro aprovado (a subconsulta aplica a RLS).
create policy "offers_select_anon"
  on public.offers for select
  to anon
  using (status = 'active' and ends_at > now()
         and exists (select 1 from public.businesses b where b.id = business_id and b.status = 'approved'));

create policy "offers_select_authenticated"
  on public.offers for select
  to authenticated
  using (
    (status = 'active' and ends_at > now()
     and exists (select 1 from public.businesses b where b.id = business_id and b.status = 'approved'))
    or private.owns_business(business_id)
    or private.is_admin()
  );

create policy "offers_insert_own"
  on public.offers for insert
  to authenticated
  with check (private.owns_business(business_id));

create policy "offers_update_own"
  on public.offers for update
  to authenticated
  using (private.owns_business(business_id))
  with check (private.owns_business(business_id));

create policy "offers_delete_own"
  on public.offers for delete
  to authenticated
  using (private.owns_business(business_id));

-- ---------------------------------------------------------------------------
-- coupons
-- ---------------------------------------------------------------------------
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- 8 caracteres sem ambíguos (sem 0/O, 1/I/L).
  code text not null unique constraint coupons_code_format check (code ~ '^[A-HJ-KM-NP-Z2-9]{8}$'),
  status public.coupon_status not null default 'issued',
  issued_at timestamptz not null default now(),
  redeemed_at timestamptz,
  expires_at timestamptz not null
);

create index coupons_user_idx on public.coupons (user_id, issued_at desc);
create index coupons_offer_idx on public.coupons (offer_id, status);

alter table public.coupons enable row level security;
revoke all on table public.coupons from anon, authenticated;
grant select on table public.coupons to authenticated;

create policy "coupons_select_own_or_partner"
  on public.coupons for select
  to authenticated
  using (user_id = (select auth.uid()) or private.owns_offer(offer_id) or private.is_admin());

create function private.new_coupon_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.coupons c where c.code = v_code);
  end loop;
  return v_code;
end;
$$;

create function public.claim_offer(p_offer_id uuid)
returns table (coupon_id uuid, code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.offers;
  v_uid uuid := (select auth.uid());
  v_coupon public.coupons;
begin
  if v_uid is null then
    raise exception 'Entre para pegar o cupom' using errcode = '42501';
  end if;

  -- Bloqueio: limites total e por usuário verificados sem corrida.
  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found or not exists (
    select 1 from public.businesses b where b.id = v_offer.business_id and b.status = 'approved'
  ) then
    raise exception 'Oferta não encontrada' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.businesses b where b.id = v_offer.business_id and b.owner_id = v_uid) then
    raise exception 'Você não pode pegar cupom da sua própria oferta' using errcode = 'GH001';
  end if;
  if v_offer.status <> 'active' then
    raise exception 'Esta oferta está pausada' using errcode = 'GH001';
  end if;
  if now() < v_offer.starts_at then
    raise exception 'Esta oferta ainda não começou' using errcode = 'GH001';
  end if;
  if now() >= v_offer.ends_at then
    raise exception 'Esta oferta já terminou' using errcode = 'GH001';
  end if;
  if v_offer.max_redemptions is not null and v_offer.issued_count >= v_offer.max_redemptions then
    raise exception 'Os cupons desta oferta esgotaram' using errcode = 'GH001';
  end if;
  if (select count(*) from public.coupons c
      where c.offer_id = p_offer_id and c.user_id = v_uid and c.status <> 'cancelled') >= v_offer.per_user_limit then
    raise exception 'Você já pegou o máximo de cupons desta oferta' using errcode = 'GH001';
  end if;

  insert into public.coupons (offer_id, user_id, code, expires_at)
  values (p_offer_id, v_uid, private.new_coupon_code(), v_offer.ends_at)
  returning * into v_coupon;
  update public.offers set issued_count = issued_count + 1 where id = p_offer_id;

  return query select v_coupon.id, v_coupon.code, v_coupon.expires_at;
end;
$$;

-- O próprio usuário desiste de um cupom ainda não usado (libera a vaga).
create function public.cancel_coupon(p_coupon_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer_id uuid;
begin
  update public.coupons set status = 'cancelled'
   where id = p_coupon_id and user_id = (select auth.uid()) and status = 'issued'
  returning offer_id into v_offer_id;
  if not found then
    raise exception 'Cupom não encontrado ou já utilizado' using errcode = 'GH001';
  end if;
  update public.offers set issued_count = greatest(issued_count - 1, 0) where id = v_offer_id;
end;
$$;

-- Resgate no balcão: só o dono do parceiro da oferta.
create function public.redeem_coupon(p_code text)
returns table (coupon_id uuid, offer_title text, discount_label text, redeemed_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_coupon public.coupons;
  v_offer public.offers;
begin
  select c.* into v_coupon from public.coupons c where c.code = v_code for update;
  if not found or not private.owns_offer(v_coupon.offer_id) then
    -- Mesma resposta para "não existe" e "não é seu": evita enumeração de códigos.
    raise exception 'Cupom não encontrado para os seus estabelecimentos' using errcode = 'P0002';
  end if;
  select * into v_offer from public.offers o where o.id = v_coupon.offer_id;

  if v_coupon.status = 'redeemed' then
    raise exception 'Cupom já utilizado em %', to_char(v_coupon.redeemed_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
      using errcode = 'GH001';
  end if;
  if v_coupon.status = 'cancelled' then
    raise exception 'Cupom cancelado pelo cliente' using errcode = 'GH001';
  end if;
  if now() >= v_coupon.expires_at then
    raise exception 'Cupom vencido' using errcode = 'GH001';
  end if;

  update public.coupons set status = 'redeemed', redeemed_at = now() where id = v_coupon.id
  returning * into v_coupon;
  return query select v_coupon.id, v_offer.title, v_offer.discount_label, v_coupon.redeemed_at;
end;
$$;

revoke all on function
  private.new_coupon_code(),
  public.claim_offer(uuid), public.cancel_coupon(uuid), public.redeem_coupon(text)
  from public, anon;
grant execute on function
  public.claim_offer(uuid), public.cancel_coupon(uuid), public.redeem_coupon(text)
  to authenticated;
