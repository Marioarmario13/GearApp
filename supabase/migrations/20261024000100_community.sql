-- Etapa 7: comunidade — amizades, bloqueios, denúncias e moderação.
--
-- Regras:
--  * Bloqueio é aplicado no BACKEND (RLS e RPCs), não só na interface: entre um par
--    com bloqueio (em qualquer direção) não há leitura de perfil/veículos públicos,
--    pedidos de amizade nem presença em eventos do outro. O bloqueado não é avisado.
--  * Amizade: pedido → aceite/recusa, só por RPCs; amizade some ao bloquear.
--  * Denúncias: qualquer autenticado denuncia perfil, veículo, parceiro, evento ou oferta;
--    sem duplicata aberta por alvo; limite diário. Só admins leem todas e resolvem
--    (resolução auditada). Moderação de veículo: admin oculta (torna privado), auditado.

create type public.friendship_status as enum ('pending', 'accepted');
create type public.report_target as enum ('profile', 'vehicle', 'business', 'event', 'offer');
create type public.report_reason as enum
  ('spam', 'offensive', 'fraud', 'dangerous_driving', 'privacy', 'other');
create type public.report_status as enum ('open', 'resolved', 'dismissed');

-- ---------------------------------------------------------------------------
-- Bloqueios
-- ---------------------------------------------------------------------------
create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;
revoke all on table public.blocks from anon, authenticated;
grant select on table public.blocks to authenticated;

-- Cada um vê apenas quem ELE bloqueou (o bloqueado não sabe).
create policy "blocks_select_own"
  on public.blocks for select
  to authenticated
  using (blocker_id = (select auth.uid()));

-- Existe bloqueio entre o usuário atual e outro (em qualquer direção)?
create function private.blocked_with(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_other is not null and exists (
    select 1 from public.blocks b
    where (b.blocker_id = (select auth.uid()) and b.blocked_id = p_other)
       or (b.blocker_id = p_other and b.blocked_id = (select auth.uid()))
  );
$$;

create function private.blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks b
    where (b.blocker_id = p_a and b.blocked_id = p_b) or (b.blocker_id = p_b and b.blocked_id = p_a)
  );
$$;

revoke all on function private.blocked_with(uuid), private.blocked_between(uuid, uuid) from public;
grant execute on function private.blocked_with(uuid), private.blocked_between(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Aplicar bloqueios nas leituras existentes
-- ---------------------------------------------------------------------------
drop policy "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (not private.blocked_with(id));

drop policy "vehicles_select_own_or_public" on public.vehicles;
create policy "vehicles_select_own_or_public"
  on public.vehicles for select
  to authenticated
  using (owner_id = (select auth.uid())
         or (visibility = 'public' and not private.blocked_with(owner_id)));

-- can_view_vehicle (fotos/Storage) também respeita bloqueios.
create or replace function private.can_view_vehicle(p_vehicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.vehicles v
    where v.id = p_vehicle_id
      and (v.owner_id = (select auth.uid())
           or (v.visibility = 'public' and not private.blocked_with(v.owner_id)))
  );
$$;

-- Presença em evento: bloqueio com o organizador impede confirmar.
create or replace function public.rsvp_event(p_event_id uuid)
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

  select * into v_event from public.events where id = p_event_id for update;
  if not found or v_event.status = 'removed' then
    raise exception 'Evento não encontrado' using errcode = 'P0002';
  end if;
  if private.blocked_between(v_uid, v_event.organizer_id) then
    -- Mensagem neutra: não revela quem bloqueou quem.
    raise exception 'Não é possível participar deste evento' using errcode = 'GH001';
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

-- ---------------------------------------------------------------------------
-- Amizades
-- ---------------------------------------------------------------------------
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friendships_not_self check (requester_id <> addressee_id)
);

-- Um único vínculo por par, independente de quem pediu.
create unique index friendships_pair_idx on public.friendships
  (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_addressee_idx on public.friendships (addressee_id, status);
create index friendships_requester_idx on public.friendships (requester_id, status);

alter table public.friendships enable row level security;
revoke all on table public.friendships from anon, authenticated;
grant select on table public.friendships to authenticated;
-- Desfazer amizade ou retirar pedido: qualquer um dos dois.
grant delete on table public.friendships to authenticated;

create policy "friendships_select_participant"
  on public.friendships for select
  to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

create policy "friendships_delete_participant"
  on public.friendships for delete
  to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

create function public.send_friend_request(p_user_id uuid)
returns public.friendship_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_existing public.friendships;
begin
  if v_uid is null then
    raise exception 'Entre para adicionar amigos' using errcode = '42501';
  end if;
  if p_user_id = v_uid then
    raise exception 'Você não pode adicionar a si mesmo' using errcode = 'GH001';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id)
     or private.blocked_between(v_uid, p_user_id) then
    -- Mesma resposta para inexistente e bloqueado.
    raise exception 'Usuário não encontrado' using errcode = 'P0002';
  end if;
  if (select count(*) from public.friendships f
      where f.requester_id = v_uid and f.status = 'pending'
        and f.created_at > now() - interval '1 day') >= 30 then
    raise exception 'Limite de 30 pedidos de amizade por dia atingido' using errcode = 'GH001';
  end if;

  select * into v_existing from public.friendships f
   where least(f.requester_id, f.addressee_id) = least(v_uid, p_user_id)
     and greatest(f.requester_id, f.addressee_id) = greatest(v_uid, p_user_id);

  if found then
    -- Pedido cruzado: a outra pessoa já tinha pedido → vira amizade.
    if v_existing.status = 'pending' and v_existing.addressee_id = v_uid then
      update public.friendships set status = 'accepted', responded_at = now() where id = v_existing.id;
      return 'accepted'::public.friendship_status;
    end if;
    return v_existing.status;
  end if;

  insert into public.friendships (requester_id, addressee_id) values (v_uid, p_user_id);
  return 'pending'::public.friendship_status;
end;
$$;

create function public.respond_friend_request(p_friendship_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_accept then
    update public.friendships set status = 'accepted', responded_at = now()
     where id = p_friendship_id and addressee_id = (select auth.uid()) and status = 'pending';
  else
    delete from public.friendships
     where id = p_friendship_id and addressee_id = (select auth.uid()) and status = 'pending';
  end if;
  if not found then
    raise exception 'Pedido não encontrado' using errcode = 'P0002';
  end if;
end;
$$;

create function public.block_user(p_user_id uuid)
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
  -- Bloquear desfaz amizade/pedidos e retira presenças cruzadas em eventos futuros.
  delete from public.friendships f
   where least(f.requester_id, f.addressee_id) = least(v_uid, p_user_id)
     and greatest(f.requester_id, f.addressee_id) = greatest(v_uid, p_user_id);
  delete from public.event_attendees a
   using public.events e
   where a.event_id = e.id and e.ends_at > now()
     and ((a.user_id = p_user_id and e.organizer_id = v_uid)
          or (a.user_id = v_uid and e.organizer_id = p_user_id));
end;
$$;

create function public.unblock_user(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.blocks where blocker_id = (select auth.uid()) and blocked_id = p_user_id;
$$;

-- Lista de amigos/pedidos com nomes públicos (somente vínculos do próprio usuário).
create function public.my_friendships()
returns table (
  friendship_id uuid, other_id uuid, username text, display_name text,
  status public.friendship_status, incoming boolean, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id,
         case when f.requester_id = (select auth.uid()) then f.addressee_id else f.requester_id end,
         p.username, p.display_name, f.status,
         f.addressee_id = (select auth.uid()), f.created_at
  from public.friendships f
  join public.profiles p
    on p.id = case when f.requester_id = (select auth.uid()) then f.addressee_id else f.requester_id end
  where (select auth.uid()) in (f.requester_id, f.addressee_id)
  order by f.status desc, f.created_at desc;
$$;

-- Usuários que EU bloqueei, com nome (para desbloquear).
create function public.my_blocks()
returns table (user_id uuid, username text, display_name text, blocked_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.blocked_id, p.username, p.display_name, b.created_at
  from public.blocks b join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = (select auth.uid())
  order by b.created_at desc;
$$;

-- ---------------------------------------------------------------------------
-- Denúncias
-- ---------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  target_type public.report_target not null,
  target_id uuid not null,
  reason public.report_reason not null,
  details text constraint reports_details_length check (char_length(details) <= 1000),
  status public.report_status not null default 'open',
  resolution_note text constraint reports_resolution_length check (char_length(resolution_note) <= 500),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index reports_open_unique_idx on public.reports (reporter_id, target_type, target_id)
  where status = 'open';
create index reports_queue_idx on public.reports (created_at) where status = 'open';
create index reports_target_idx on public.reports (target_type, target_id);

create function private.validate_report()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.status := 'open';
  new.resolution_note := null;
  new.resolved_by := null;
  new.resolved_at := null;
  if (select count(*) from public.reports r
      where r.reporter_id = new.reporter_id and r.created_at > now() - interval '1 day') >= 20 then
    raise exception 'Limite de 20 denúncias por dia atingido' using errcode = 'GH001';
  end if;
  return new;
end;
$$;

create trigger reports_validate
  before insert on public.reports
  for each row execute function private.validate_report();

alter table public.reports enable row level security;
revoke all on table public.reports from anon, authenticated;
grant select on table public.reports to authenticated;
grant insert (target_type, target_id, reason, details) on table public.reports to authenticated;

create policy "reports_select_own_or_admin"
  on public.reports for select
  to authenticated
  using (reporter_id = (select auth.uid()) or private.is_admin());

create policy "reports_insert_own"
  on public.reports for insert
  to authenticated
  with check (reporter_id = (select auth.uid()));

create function public.resolve_report(
  p_report_id uuid,
  p_status public.report_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text := nullif(btrim(p_note), '');
  v_report public.reports;
begin
  if not private.is_admin() then
    raise exception 'Apenas administradores podem resolver denúncias' using errcode = '42501';
  end if;
  if p_status not in ('resolved', 'dismissed') then
    raise exception 'Decisão inválida' using errcode = 'GH001';
  end if;
  update public.reports
     set status = p_status, resolution_note = v_note, resolved_by = (select auth.uid()), resolved_at = now()
   where id = p_report_id and status = 'open'
  returning * into v_report;
  if not found then
    raise exception 'Denúncia não encontrada ou já resolvida' using errcode = 'P0002';
  end if;
  perform private.audit('report.' || p_status::text, 'report', p_report_id,
    jsonb_build_object('target_type', v_report.target_type, 'target_id', v_report.target_id, 'note', v_note));
end;
$$;

-- Moderação: ocultar veículo (vira privado). Dono continua vendo.
create function public.moderate_hide_vehicle(p_vehicle_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Apenas administradores podem moderar' using errcode = '42501';
  end if;
  if char_length(coalesce(btrim(p_note), '')) < 5 then
    raise exception 'Explique o motivo (mínimo de 5 caracteres)' using errcode = 'GH001';
  end if;
  update public.vehicles set visibility = 'private' where id = p_vehicle_id;
  if not found then
    raise exception 'Veículo não encontrado' using errcode = 'P0002';
  end if;
  perform private.audit('vehicle.hidden', 'vehicle', p_vehicle_id, jsonb_build_object('note', btrim(p_note)));
end;
$$;

-- Admin: perfil público mínimo de qualquer usuário (para analisar denúncias).
create function public.admin_list_reports(p_status public.report_status default 'open', p_limit integer default 100)
returns table (
  id uuid, target_type public.report_target, target_id uuid, reason public.report_reason,
  details text, status public.report_status, resolution_note text, created_at timestamptz,
  reporter_username text, same_target_open bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.target_type, r.target_id, r.reason, r.details, r.status, r.resolution_note, r.created_at,
         p.username,
         (select count(*) from public.reports r2
          where r2.target_type = r.target_type and r2.target_id = r.target_id and r2.status = 'open')
  from public.reports r
  join public.profiles p on p.id = r.reporter_id
  where private.is_admin() and r.status = p_status
  order by r.created_at
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;

revoke all on function
  public.send_friend_request(uuid), public.respond_friend_request(uuid, boolean),
  public.block_user(uuid), public.unblock_user(uuid), public.my_friendships(), public.my_blocks(),
  public.resolve_report(uuid, public.report_status, text), public.moderate_hide_vehicle(uuid, text),
  public.admin_list_reports(public.report_status, integer)
  from public, anon;
grant execute on function
  public.send_friend_request(uuid), public.respond_friend_request(uuid, boolean),
  public.block_user(uuid), public.unblock_user(uuid), public.my_friendships(), public.my_blocks(),
  public.resolve_report(uuid, public.report_status, text), public.moderate_hide_vehicle(uuid, text),
  public.admin_list_reports(public.report_status, integer)
  to authenticated;
