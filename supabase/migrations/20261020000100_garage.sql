-- Etapa 3: garagem — veículos, placa privada, fotos e bucket de Storage.
--
-- Regras:
--  * Dono faz CRUD dos próprios veículos; ninguém altera owner_id.
--  * Veículo público é visível a autenticados; privado só ao dono.
--  * Placa fica em tabela separada e só o dono lê (nunca exposta a terceiros).
--  * Fotos ficam no bucket privado `vehicle-photos` em `<owner_id>/<vehicle_id>/<arquivo>`;
--    terceiros só leem fotos de veículos públicos (via URL assinada).
--  * Limites anti-abuso: 20 veículos por usuário, 10 fotos por veículo.

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.vehicle_visibility as enum ('public', 'private');

-- ---------------------------------------------------------------------------
-- vehicles
-- ---------------------------------------------------------------------------
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  make text not null constraint vehicles_make_length check (char_length(btrim(make)) between 1 and 60),
  model text not null constraint vehicles_model_length check (char_length(btrim(model)) between 1 and 80),
  year smallint not null constraint vehicles_year_min check (year >= 1886),
  nickname text constraint vehicles_nickname_length check (char_length(btrim(nickname)) between 1 and 60),
  visibility public.vehicle_visibility not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index vehicles_owner_id_idx on public.vehicles (owner_id, created_at desc);
create index vehicles_public_idx on public.vehicles (created_at desc) where visibility = 'public';

comment on table public.vehicles is 'Veículos da garagem virtual. Placa fica em vehicle_private.';

create trigger vehicles_set_updated_at
  before update on public.vehicles
  for each row execute function private.set_updated_at();

-- Ano máximo depende da data atual (não cabe em CHECK, que deve ser imutável).
create function private.validate_vehicle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.year > extract(year from now())::int + 1 then
    raise exception 'Ano do veículo inválido' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' and (
    select count(*) from public.vehicles v where v.owner_id = new.owner_id
  ) >= 20 then
    raise exception 'Limite de 20 veículos por usuário atingido' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger vehicles_validate
  before insert or update on public.vehicles
  for each row execute function private.validate_vehicle();

alter table public.vehicles enable row level security;
revoke all on table public.vehicles from anon, authenticated;

grant select (id, owner_id, make, model, year, nickname, visibility, created_at, updated_at)
  on table public.vehicles to authenticated;
-- owner_id fora do grant: sempre preenchido pelo default auth.uid().
grant insert (make, model, year, nickname, visibility) on table public.vehicles to authenticated;
grant update (make, model, year, nickname, visibility) on table public.vehicles to authenticated;
grant delete on table public.vehicles to authenticated;

create policy "vehicles_select_own_or_public"
  on public.vehicles for select
  to authenticated
  using (owner_id = (select auth.uid()) or visibility = 'public');

create policy "vehicles_insert_own"
  on public.vehicles for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "vehicles_update_own"
  on public.vehicles for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "vehicles_delete_own"
  on public.vehicles for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- Usado pelas policies de vehicle_private, vehicle_photos e storage.
create function private.owns_vehicle(p_vehicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.vehicles v
    where v.id = p_vehicle_id and v.owner_id = (select auth.uid())
  );
$$;

create function private.can_view_vehicle(p_vehicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.vehicles v
    where v.id = p_vehicle_id
      and (v.owner_id = (select auth.uid()) or v.visibility = 'public')
  );
$$;

-- Valida o caminho "<owner>/<vehicle>/<arquivo>" sem lançar erro de cast para nomes malformados.
create function private.owns_vehicle_folder(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_parts text[] := string_to_array(p_name, '/');
begin
  if array_length(v_parts, 1) <> 3
     or v_parts[1] <> (select auth.uid())::text
     or v_parts[2] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return private.owns_vehicle(v_parts[2]::uuid);
end;
$$;

revoke all on function private.owns_vehicle(uuid), private.can_view_vehicle(uuid),
  private.owns_vehicle_folder(text) from public;
grant execute on function private.owns_vehicle(uuid), private.can_view_vehicle(uuid),
  private.owns_vehicle_folder(text) to authenticated;

-- ---------------------------------------------------------------------------
-- vehicle_private — dados do veículo que só o dono vê (placa)
-- ---------------------------------------------------------------------------
create table public.vehicle_private (
  vehicle_id uuid primary key references public.vehicles (id) on delete cascade,
  plate text
    constraint vehicle_private_plate_format check (plate ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'),
  updated_at timestamptz not null default now()
);

create trigger vehicle_private_set_updated_at
  before update on public.vehicle_private
  for each row execute function private.set_updated_at();

alter table public.vehicle_private enable row level security;
revoke all on table public.vehicle_private from anon, authenticated;
grant select (vehicle_id, plate, updated_at) on table public.vehicle_private to authenticated;
grant insert (vehicle_id, plate) on table public.vehicle_private to authenticated;
grant update (plate) on table public.vehicle_private to authenticated;
grant delete on table public.vehicle_private to authenticated;

create policy "vehicle_private_owner_all"
  on public.vehicle_private for all
  to authenticated
  using (private.owns_vehicle(vehicle_id))
  with check (private.owns_vehicle(vehicle_id));

-- ---------------------------------------------------------------------------
-- vehicle_photos
-- ---------------------------------------------------------------------------
create table public.vehicle_photos (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  -- O caminho precisa estar na pasta do próprio veículo: <owner>/<vehicle>/<arquivo>.
  constraint vehicle_photos_path_format check (
    storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[A-Za-z0-9_-]{1,64}\.(jpg|jpeg|png|webp)$'
  )
);

create index vehicle_photos_vehicle_id_idx on public.vehicle_photos (vehicle_id, created_at);

create function private.validate_vehicle_photo()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select v.owner_id into v_owner from public.vehicles v where v.id = new.vehicle_id;

  if split_part(new.storage_path, '/', 1) <> v_owner::text
     or split_part(new.storage_path, '/', 2) <> new.vehicle_id::text then
    raise exception 'Caminho da foto não pertence ao veículo' using errcode = '23514';
  end if;

  if (select count(*) from public.vehicle_photos p where p.vehicle_id = new.vehicle_id) >= 10 then
    raise exception 'Limite de 10 fotos por veículo atingido' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger vehicle_photos_validate
  before insert on public.vehicle_photos
  for each row execute function private.validate_vehicle_photo();

alter table public.vehicle_photos enable row level security;
revoke all on table public.vehicle_photos from anon, authenticated;
grant select (id, vehicle_id, storage_path, created_at) on table public.vehicle_photos to authenticated;
grant insert (vehicle_id, storage_path) on table public.vehicle_photos to authenticated;
grant delete on table public.vehicle_photos to authenticated;

create policy "vehicle_photos_select_visible"
  on public.vehicle_photos for select
  to authenticated
  using (private.can_view_vehicle(vehicle_id));

create policy "vehicle_photos_insert_own"
  on public.vehicle_photos for insert
  to authenticated
  with check (private.owns_vehicle(vehicle_id));

create policy "vehicle_photos_delete_own"
  on public.vehicle_photos for delete
  to authenticated
  using (private.owns_vehicle(vehicle_id));

-- ---------------------------------------------------------------------------
-- Storage: bucket privado com limite de tamanho e tipos
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vehicle-photos', 'vehicle-photos', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Upload apenas na pasta do próprio veículo.
create policy "vehicle_photos_storage_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'vehicle-photos'
    and private.owns_vehicle_folder(name)
  );

-- Leitura: dono, ou foto registrada de veículo público.
create policy "vehicle_photos_storage_select_visible"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'vehicle-photos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.vehicle_photos p
        where p.storage_path = name and private.can_view_vehicle(p.vehicle_id)
      )
    )
  );

create policy "vehicle_photos_storage_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'vehicle-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
