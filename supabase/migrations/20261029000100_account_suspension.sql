-- Suspensão de contas pela moderação, sem chave de serviço:
--   1. RPCs de admin gravam/removem a suspensão (auditadas) e encerram as sessões ativas;
--   2. o hook "custom access token" do Auth recusa emitir tokens (login e renovação);
--   3. o "pre-request" do PostgREST recusa qualquer requisição de quem está suspenso
--      (cobre o token de acesso que ainda não expirou);
--   4. as policies de upload do Storage também checam a suspensão.

create table public.account_suspensions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  reason text not null constraint account_suspensions_reason_length
    check (char_length(btrim(reason)) between 5 and 500),
  suspended_by uuid references public.profiles (id) on delete set null,
  suspended_at timestamptz not null default now()
);

alter table public.account_suspensions enable row level security;
-- Sem grants e sem policies: acesso só pelas RPCs abaixo.
revoke all on table public.account_suspensions from anon, authenticated;

create function private.is_suspended(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null
     and exists (select 1 from public.account_suspensions s where s.user_id = p_user_id);
$$;

revoke all on function private.is_suspended(uuid) from public;
grant execute on function private.is_suspended(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Ganchos (schema próprio, fora da API; os papéis só precisam de USAGE)
-- ---------------------------------------------------------------------------
create schema if not exists hooks;
revoke all on schema hooks from public;
grant usage on schema hooks to anon, authenticated, supabase_auth_admin;

-- PostgREST: roda antes de cada requisição (configurado no papel authenticator abaixo).
create function hooks.check_request()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.is_suspended((select auth.uid())) then
    raise exception 'Sua conta está suspensa. Fale com a equipe Gearhead.' using errcode = 'GH001';
  end if;
end;
$$;

revoke all on function hooks.check_request() from public;
grant execute on function hooks.check_request() to anon, authenticated;

alter role authenticator set pgrst.db_pre_request = 'hooks.check_request';
notify pgrst, 'reload config';

-- Auth: recusa emitir token (login, renovação) para conta suspensa.
-- Ativado em supabase/config.toml ([auth.hook.custom_access_token]); em produção, no painel.
create function hooks.custom_access_token(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.is_suspended((event ->> 'user_id')::uuid) then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Sua conta está suspensa. Fale com a equipe Gearhead.'
      )
    );
  end if;
  return jsonb_build_object('claims', event -> 'claims');
end;
$$;

revoke all on function hooks.custom_access_token(jsonb) from public, anon, authenticated;
grant execute on function hooks.custom_access_token(jsonb) to supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- Storage: suspenso não envia arquivos (o Storage não passa pelo pre-request)
-- ---------------------------------------------------------------------------
create policy "no_uploads_when_suspended"
  on storage.objects as restrictive for insert
  to authenticated
  with check (not private.is_suspended((select auth.uid())));

create policy "no_updates_when_suspended"
  on storage.objects as restrictive for update
  to authenticated
  using (not private.is_suspended((select auth.uid())));

-- ---------------------------------------------------------------------------
-- RPCs de moderação
-- ---------------------------------------------------------------------------
create function public.admin_suspend_user(p_user_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not private.is_admin() then
    raise exception 'Apenas administradores' using errcode = '42501';
  end if;
  if char_length(v_reason) not between 5 and 500 then
    raise exception 'Informe o motivo da suspensão (5 a 500 caracteres).' using errcode = 'GH001';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'Você não pode suspender a própria conta.' using errcode = 'GH001';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Usuário não encontrado.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.profiles where id = p_user_id and role = 'admin') then
    raise exception 'Remova o papel de administrador antes de suspender.' using errcode = 'GH001';
  end if;

  insert into public.account_suspensions (user_id, reason, suspended_by)
  values (p_user_id, v_reason, (select auth.uid()))
  on conflict (user_id) do update
    set reason = excluded.reason, suspended_by = excluded.suspended_by, suspended_at = now();

  -- Encerra sessões (refresh tokens vão junto) e qualquer localização ativa.
  delete from auth.sessions where user_id = p_user_id;
  update public.location_sessions
     set revoked_at = now(), latitude = null, longitude = null, accuracy_m = null, position_at = null
   where owner_id = p_user_id and revoked_at is null and expires_at > now();
  delete from public.ephemeral_presence where user_id = p_user_id;

  perform private.audit('user.suspended', 'profile', p_user_id, jsonb_build_object('reason', v_reason));
end;
$$;

create function public.admin_unsuspend_user(p_user_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text := btrim(coalesce(p_note, ''));
begin
  if not private.is_admin() then
    raise exception 'Apenas administradores' using errcode = '42501';
  end if;
  if char_length(v_note) not between 5 and 500 then
    raise exception 'Informe o motivo da reativação (5 a 500 caracteres).' using errcode = 'GH001';
  end if;
  delete from public.account_suspensions where user_id = p_user_id;
  if not found then
    raise exception 'Esta conta não está suspensa.' using errcode = 'GH001';
  end if;
  perform private.audit('user.unsuspended', 'profile', p_user_id, jsonb_build_object('note', v_note));
end;
$$;

create function public.admin_list_suspensions()
returns table (
  user_id uuid, username text, display_name text, reason text,
  suspended_at timestamptz, suspended_by_username text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Apenas administradores' using errcode = '42501';
  end if;
  return query
    select s.user_id, p.username, p.display_name, s.reason, s.suspended_at, a.username
    from public.account_suspensions s
    join public.profiles p on p.id = s.user_id
    left join public.profiles a on a.id = s.suspended_by
    order by s.suspended_at desc;
end;
$$;

revoke all on function
  public.admin_suspend_user(uuid, text),
  public.admin_unsuspend_user(uuid, text),
  public.admin_list_suspensions()
from public, anon;
grant execute on function
  public.admin_suspend_user(uuid, text),
  public.admin_unsuspend_user(uuid, text),
  public.admin_list_suspensions()
to authenticated;
