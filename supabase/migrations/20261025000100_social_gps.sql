-- Etapa 8: GPS social seguro — compartilhamento temporário de localização e
-- presença aproximada para descoberta entre amigos.
--
-- Regras (docs/SECURITY.md):
--  * Localização desligada por padrão: nada é coletado sem o usuário abrir uma sessão.
--  * Sessão = finalidade + destinatários (amigos aceitos, sem bloqueio) + prazo
--    (5 min a 8 h). Revogação imediata; expiração automática pelo relógio do banco.
--  * Sem histórico: guardamos só a ÚLTIMA posição, sobrescrita a cada atualização;
--    ela é apagada ao revogar e na limpeza de sessões expiradas (feita a cada acesso
--    às RPCs e disponível para agendamento em produção).
--  * Coordenadas exatas só para destinatários autorizados, enquanto a sessão está ativa
--    e sem bloqueio. Nenhuma tabela desta etapa é legível diretamente pelos clientes.
--  * Atualizações limitadas (mínimo de 30 s) — não coletar GPS mais do que o necessário.
--  * Presença aproximada: opt-in, até 2 h, célula de ~5,5 km; amigos veem apenas uma
--    faixa de distância, nunca coordenadas (dificulta triangulação).

create type public.location_purpose as enum ('meetup', 'convoy', 'safety', 'other');

-- ---------------------------------------------------------------------------
-- Sessões de compartilhamento
-- ---------------------------------------------------------------------------
create table public.location_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  purpose public.location_purpose not null,
  purpose_note text constraint location_sessions_note_length check (char_length(purpose_note) <= 120),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  -- Última posição conhecida (sem histórico).
  latitude double precision constraint location_sessions_lat check (latitude between -90 and 90),
  longitude double precision constraint location_sessions_lng check (longitude between -180 and 180),
  accuracy_m real constraint location_sessions_accuracy check (accuracy_m between 0 and 100000),
  position_at timestamptz,
  constraint location_sessions_duration check (
    expires_at >= started_at + interval '5 minutes' and expires_at <= started_at + interval '8 hours'
  ),
  constraint location_sessions_position_pair check ((latitude is null) = (longitude is null))
);

create index location_sessions_owner_idx on public.location_sessions (owner_id, started_at desc);
create index location_sessions_active_idx on public.location_sessions (expires_at)
  where revoked_at is null;

create table public.location_session_recipients (
  session_id uuid not null references public.location_sessions (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  primary key (session_id, recipient_id)
);

create index location_session_recipients_recipient_idx on public.location_session_recipients (recipient_id);

-- Sem acesso direto: tudo passa pelas RPCs abaixo.
alter table public.location_sessions enable row level security;
alter table public.location_session_recipients enable row level security;
revoke all on table public.location_sessions, public.location_session_recipients from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Presença aproximada
-- ---------------------------------------------------------------------------
create table public.ephemeral_presence (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  -- Célula de 0,05° (~5,5 km): nunca a posição real.
  cell_lat numeric(6, 2) not null,
  cell_lng numeric(6, 2) not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index ephemeral_presence_expires_idx on public.ephemeral_presence (expires_at);

alter table public.ephemeral_presence enable row level security;
revoke all on table public.ephemeral_presence from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Funções auxiliares
-- ---------------------------------------------------------------------------
create function private.are_friends(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and least(f.requester_id, f.addressee_id) = least(p_a, p_b)
      and greatest(f.requester_id, f.addressee_id) = greatest(p_a, p_b)
  );
$$;

-- Apaga posições de sessões encerradas e presenças vencidas. Idempotente e barata.
create function private.purge_expired_locations()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.location_sessions
     set latitude = null, longitude = null, accuracy_m = null, position_at = null
   where latitude is not null and (revoked_at is not null or expires_at <= now());
  delete from public.ephemeral_presence where expires_at <= now();
$$;

revoke all on function private.are_friends(uuid, uuid), private.purge_expired_locations() from public;

-- Célula grosseira (0,05°) para presença aproximada.
create function private.coarse(p_value double precision)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select round((p_value / 0.05)::numeric) * 0.05;
$$;

revoke all on function private.coarse(double precision) from public;

-- ---------------------------------------------------------------------------
-- RPCs de sessão
-- ---------------------------------------------------------------------------
create function public.start_location_session(
  p_purpose public.location_purpose,
  p_minutes integer,
  p_recipient_ids uuid[],
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_session uuid;
  v_recipient uuid;
  v_ids uuid[] := array(select distinct unnest(coalesce(p_recipient_ids, '{}'::uuid[])));
begin
  if v_uid is null then
    raise exception 'Entre para compartilhar sua localização' using errcode = '42501';
  end if;
  perform private.purge_expired_locations();
  if p_minutes is null or p_minutes < 5 or p_minutes > 480 then
    raise exception 'Duração entre 5 minutos e 8 horas' using errcode = 'GH001';
  end if;
  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'Escolha ao menos um amigo para compartilhar' using errcode = 'GH001';
  end if;
  if array_length(v_ids, 1) > 20 then
    raise exception 'Máximo de 20 destinatários por sessão' using errcode = 'GH001';
  end if;
  foreach v_recipient in array v_ids loop
    if v_recipient = v_uid or not private.are_friends(v_uid, v_recipient)
       or private.blocked_between(v_uid, v_recipient) then
      raise exception 'Só é possível compartilhar com amigos' using errcode = 'GH001';
    end if;
  end loop;

  -- Uma sessão ativa por vez: abrir uma nova encerra a anterior.
  update public.location_sessions
     set revoked_at = now(), latitude = null, longitude = null, accuracy_m = null, position_at = null
   where owner_id = v_uid and revoked_at is null and expires_at > now();

  insert into public.location_sessions (owner_id, purpose, purpose_note, expires_at)
  values (v_uid, p_purpose, nullif(btrim(p_note), ''), now() + make_interval(mins => p_minutes))
  returning id into v_session;
  insert into public.location_session_recipients (session_id, recipient_id)
  select v_session, unnest(v_ids);
  return v_session;
end;
$$;

create function public.update_session_location(
  p_session_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m real default null
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.location_sessions;
begin
  select * into v_session from public.location_sessions
   where id = p_session_id and owner_id = (select auth.uid()) for update;
  if not found or v_session.revoked_at is not null or v_session.expires_at <= now() then
    raise exception 'Sessão de compartilhamento não está ativa' using errcode = 'GH001';
  end if;
  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'Coordenadas inválidas' using errcode = 'GH001';
  end if;
  if v_session.position_at is not null and v_session.position_at > now() - interval '30 seconds' then
    -- Ignora atualizações mais frequentes que o necessário (sem erro para o app).
    return v_session.position_at;
  end if;
  update public.location_sessions
     set latitude = round(p_latitude::numeric, 5), longitude = round(p_longitude::numeric, 5),
         accuracy_m = p_accuracy_m, position_at = now()
   where id = p_session_id;
  return now();
end;
$$;

create function public.stop_location_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.location_sessions
     set revoked_at = now(), latitude = null, longitude = null, accuracy_m = null, position_at = null
   where id = p_session_id and owner_id = (select auth.uid()) and revoked_at is null;
  if not found then
    raise exception 'Sessão não encontrada ou já encerrada' using errcode = 'P0002';
  end if;
end;
$$;

-- Minha sessão ativa (com destinatários), se houver.
create function public.my_location_session()
returns table (
  id uuid, purpose public.location_purpose, purpose_note text, started_at timestamptz,
  expires_at timestamptz, position_at timestamptz, recipients jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.purge_expired_locations();
  return query
    select s.id, s.purpose, s.purpose_note, s.started_at, s.expires_at, s.position_at,
           coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name))
                     from public.location_session_recipients r join public.profiles p on p.id = r.recipient_id
                     where r.session_id = s.id), '[]'::jsonb)
    from public.location_sessions s
    where s.owner_id = (select auth.uid()) and s.revoked_at is null and s.expires_at > now()
    order by s.started_at desc
    limit 1;
end;
$$;

-- Localizações compartilhadas COMIGO (exatas), só de sessões ativas e sem bloqueio.
create function public.shared_locations_for_me()
returns table (
  session_id uuid, owner_id uuid, username text, display_name text,
  purpose public.location_purpose, purpose_note text, latitude double precision,
  longitude double precision, accuracy_m real, position_at timestamptz, expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Entre para ver localizações compartilhadas' using errcode = '42501';
  end if;
  perform private.purge_expired_locations();
  return query
    select s.id, s.owner_id, p.username, p.display_name, s.purpose, s.purpose_note,
           s.latitude, s.longitude, s.accuracy_m, s.position_at, s.expires_at
    from public.location_session_recipients r
    join public.location_sessions s on s.id = r.session_id
    join public.profiles p on p.id = s.owner_id
    where r.recipient_id = v_uid
      and s.revoked_at is null and s.expires_at > now()
      and not private.blocked_between(v_uid, s.owner_id)
      and private.are_friends(v_uid, s.owner_id)
    order by s.position_at desc nulls last;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPCs de presença aproximada
-- ---------------------------------------------------------------------------
create function public.set_presence(p_latitude double precision, p_longitude double precision, p_minutes integer default 60)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_expires timestamptz;
begin
  if v_uid is null then
    raise exception 'Entre para aparecer para amigos' using errcode = '42501';
  end if;
  if p_minutes is null or p_minutes < 5 or p_minutes > 120 then
    raise exception 'Duração entre 5 minutos e 2 horas' using errcode = 'GH001';
  end if;
  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'Coordenadas inválidas' using errcode = 'GH001';
  end if;
  v_expires := now() + make_interval(mins => p_minutes);
  insert into public.ephemeral_presence (user_id, cell_lat, cell_lng, expires_at, updated_at)
  values (v_uid, private.coarse(p_latitude), private.coarse(p_longitude), v_expires, now())
  on conflict (user_id) do update
    set cell_lat = excluded.cell_lat, cell_lng = excluded.cell_lng,
        expires_at = excluded.expires_at, updated_at = now();
  return v_expires;
end;
$$;

create function public.clear_presence()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.ephemeral_presence where user_id = (select auth.uid());
$$;

-- Amigos por perto: só faixas de distância a partir das células (nunca coordenadas).
create function public.nearby_friends(p_latitude double precision, p_longitude double precision)
returns table (user_id uuid, username text, display_name text, distance_band text, until timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_lat numeric;
  v_lng numeric;
begin
  if v_uid is null then
    raise exception 'Entre para ver amigos por perto' using errcode = '42501';
  end if;
  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'Coordenadas inválidas' using errcode = 'GH001';
  end if;
  perform private.purge_expired_locations();
  -- A posição de quem consulta também é arredondada para a célula.
  v_lat := private.coarse(p_latitude);
  v_lng := private.coarse(p_longitude);
  return query
    with d as (
      select e.user_id, e.expires_at,
             extensions.st_distance(
               extensions.st_setsrid(extensions.st_makepoint(e.cell_lng::float8, e.cell_lat::float8), 4326)::extensions.geography,
               extensions.st_setsrid(extensions.st_makepoint(v_lng::float8, v_lat::float8), 4326)::extensions.geography
             ) as meters
      from public.ephemeral_presence e
      where e.user_id <> v_uid and e.expires_at > now()
        and private.are_friends(v_uid, e.user_id)
        and not private.blocked_between(v_uid, e.user_id)
    )
    select d.user_id, p.username, p.display_name,
           case when d.meters < 6000 then 'até 5 km'
                when d.meters < 21000 then '5 a 20 km'
                else '20 a 50 km' end,
           d.expires_at
    from d join public.profiles p on p.id = d.user_id
    where d.meters < 51000
    order by d.meters, p.display_name
    limit 50;
end;
$$;

revoke all on function
  public.start_location_session(public.location_purpose, integer, uuid[], text),
  public.update_session_location(uuid, double precision, double precision, real),
  public.stop_location_session(uuid), public.my_location_session(), public.shared_locations_for_me(),
  public.set_presence(double precision, double precision, integer), public.clear_presence(),
  public.nearby_friends(double precision, double precision)
  from public, anon;
grant execute on function
  public.start_location_session(public.location_purpose, integer, uuid[], text),
  public.update_session_location(uuid, double precision, double precision, real),
  public.stop_location_session(uuid), public.my_location_session(), public.shared_locations_for_me(),
  public.set_presence(double precision, double precision, integer), public.clear_presence(),
  public.nearby_friends(double precision, double precision)
  to authenticated;

-- Bloquear alguém encerra o compartilhamento entre os dois imediatamente.
create or replace function public.block_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or p_user_id = v_uid then
    raise exception 'Operação inválida' using errcode = 'GH001';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'Usuário não encontrado' using errcode = 'P0002';
  end if;
  insert into public.blocks (blocker_id, blocked_id) values (v_uid, p_user_id) on conflict do nothing;
  delete from public.friendships f
   where least(f.requester_id, f.addressee_id) = least(v_uid, p_user_id)
     and greatest(f.requester_id, f.addressee_id) = greatest(v_uid, p_user_id);
  delete from public.event_attendees a
   using public.events e
   where a.event_id = e.id and e.ends_at > now()
     and ((a.user_id = p_user_id and e.organizer_id = v_uid)
          or (a.user_id = v_uid and e.organizer_id = p_user_id));
  delete from public.location_session_recipients r
   using public.location_sessions s
   where r.session_id = s.id
     and ((s.owner_id = v_uid and r.recipient_id = p_user_id)
          or (s.owner_id = p_user_id and r.recipient_id = v_uid));
end;
$$;
