-- Etapa 2: perfis de usuário, papéis e RLS.
--
-- Regras:
--  * Um perfil por usuário de auth.users, criado por trigger (clientes não inserem).
--  * Usuário edita apenas campos públicos do próprio perfil (grants por coluna + RLS).
--  * `role` nunca é alterado pelo cliente; só via public.set_user_role() por um admin.
--  * Leitura de perfis apenas para usuários autenticados; `role` não é exposto a terceiros.

-- ---------------------------------------------------------------------------
-- Tipos e schema privado (não exposto pela API)
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('user', 'admin');

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Tabela
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique
    constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,30}$'),
  display_name text
    constraint profiles_display_name_length check (char_length(btrim(display_name)) between 1 and 60),
  city text
    constraint profiles_city_length check (char_length(btrim(city)) between 1 and 80),
  state char(2)
    constraint profiles_state_uf check (
      state in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
                'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')
    ),
  avatar_url text
    constraint profiles_avatar_url_length check (char_length(avatar_url) <= 500),
  role public.app_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Perfil público mínimo de cada usuário. role é protegido.';

-- ---------------------------------------------------------------------------
-- Funções auxiliares
-- ---------------------------------------------------------------------------
create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Cria o perfil quando um usuário se cadastra. Username/display_name vêm do
-- metadata do cadastro; valores inválidos ou já usados viram NULL para nunca
-- bloquear o cadastro (o usuário ajusta depois no perfil).
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := lower(btrim(new.raw_user_meta_data ->> 'username'));
  v_display_name text := nullif(btrim(new.raw_user_meta_data ->> 'display_name'), '');
begin
  if v_username !~ '^[a-z0-9_]{3,30}$' then
    v_username := null;
  end if;
  if char_length(v_display_name) > 60 then
    v_display_name := null;
  end if;

  begin
    insert into public.profiles (id, username, display_name)
    values (new.id, v_username, v_display_name);
  exception when unique_violation then
    insert into public.profiles (id, username, display_name)
    values (new.id, null, v_display_name);
  end;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS e grants
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;

-- Leitura: colunas públicas apenas (role fica de fora).
grant select (id, username, display_name, city, state, avatar_url, created_at, updated_at)
  on table public.profiles to authenticated;

-- Edição: somente campos editáveis pelo próprio usuário.
grant update (username, display_name, city, state, avatar_url)
  on table public.profiles to authenticated;

-- Sem INSERT/DELETE para clientes: perfil nasce no trigger e morre em cascata com auth.users.

create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Papel do usuário atual (role não é legível diretamente pela tabela).
create function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid());
$$;

revoke all on function public.current_user_role() from public, anon;
grant execute on function public.current_user_role() to authenticated;

-- Alteração de papel: apenas administradores. (Auditoria entra na Etapa 7.)
create function public.set_user_role(target_user_id uuid, new_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Apenas administradores podem alterar papéis'
      using errcode = '42501';
  end if;

  update public.profiles set role = new_role where id = target_user_id;

  if not found then
    raise exception 'Usuário não encontrado' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.set_user_role(uuid, public.app_role) from public, anon;
grant execute on function public.set_user_role(uuid, public.app_role) to authenticated;
