-- Etapa 4: parceiros (estabelecimentos/profissionais), especialidades, credenciais,
-- documentos privados, aprovação administrativa e auditoria.
--
-- Regras:
--  * Qualquer usuário cadastra um parceiro; ele nasce `pending` e só aparece no
--    diretório público quando um admin aprova.
--  * Aprovar exige um documento de registro (CNPJ/MEI) JÁ CONFERIDO por admin:
--    o selo "verificado" nunca existe sem conferência documentada.
--  * Certificações só são públicas depois de aprovadas, uma a uma.
--  * Dono não altera status/revisão; mudar nome ou tipo de um parceiro aprovado
--    devolve-o para `pending` (nova conferência).
--  * Documentos ficam em bucket privado: só dono e admins leem. Arquivo de
--    credencial aprovada não pode ser apagado pelo dono (preserva a evidência).
--  * Toda ação administrativa grava em audit_logs (append-only).
--  * Erros de regra de negócio usam SQLSTATE 'GH001' com mensagem em pt-BR,
--    que a UI pode exibir diretamente.

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.business_kind as enum
  ('workshop', 'mechanic', 'tuner', 'gas_station', 'parts_store', 'detailing');
create type public.business_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.credential_type as enum
  ('business_registration', 'certification', 'training', 'other');
create type public.credential_status as enum ('pending', 'approved', 'rejected');

-- ---------------------------------------------------------------------------
-- Auditoria (append-only; escrita só por funções security definer)
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);

alter table public.audit_logs enable row level security;
revoke all on table public.audit_logs from anon, authenticated;
grant select on table public.audit_logs to authenticated;

create policy "audit_logs_select_admin"
  on public.audit_logs for select
  to authenticated
  using (private.is_admin());

create function private.audit(p_action text, p_entity_type text, p_entity_id uuid, p_details jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;

revoke all on function private.audit(text, text, uuid, jsonb) from public;

-- ---------------------------------------------------------------------------
-- Especialidades (catálogo de referência, mantido por migração)
-- ---------------------------------------------------------------------------
create table public.specialties (
  id text primary key constraint specialties_id_slug check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null unique,
  sort smallint not null default 0
);

alter table public.specialties enable row level security;
revoke all on table public.specialties from anon, authenticated;
grant select on table public.specialties to anon, authenticated;

create policy "specialties_select_all"
  on public.specialties for select
  to anon, authenticated
  using (true);

insert into public.specialties (id, name, sort) values
  ('mecanica-geral', 'Mecânica geral', 10),
  ('injecao-eletronica', 'Injeção eletrônica', 20),
  ('eletrica', 'Elétrica automotiva', 30),
  ('suspensao', 'Suspensão e direção', 40),
  ('freios', 'Freios', 50),
  ('cambio', 'Câmbio e embreagem', 60),
  ('ar-condicionado', 'Ar-condicionado', 70),
  ('alinhamento', 'Alinhamento e balanceamento', 80),
  ('pneus', 'Pneus', 90),
  ('funilaria-pintura', 'Funilaria e pintura', 100),
  ('estetica', 'Estética automotiva', 110),
  ('preparacao-motor', 'Preparação de motor', 120),
  ('remap', 'Remapeamento de ECU', 130),
  ('diesel', 'Motores diesel', 140),
  ('gnv', 'GNV', 150),
  ('hibridos-eletricos', 'Híbridos e elétricos', 160),
  ('som-multimidia', 'Som e multimídia', 170),
  ('restauracao', 'Restauração de clássicos', 180);

-- ---------------------------------------------------------------------------
-- businesses
-- ---------------------------------------------------------------------------
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind public.business_kind not null,
  name text not null constraint businesses_name_length check (char_length(btrim(name)) between 2 and 80),
  description text constraint businesses_description_length check (char_length(description) <= 1000),
  phone text constraint businesses_phone_format check (phone ~ '^[0-9]{10,11}$'),
  phone_is_whatsapp boolean not null default false,
  email text constraint businesses_email_format
    check (char_length(email) <= 120 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  website text constraint businesses_website_format
    check (char_length(website) <= 200 and website ~* '^https?://[^[:space:]]+$'),
  street text constraint businesses_street_length check (char_length(btrim(street)) between 1 and 120),
  street_number text constraint businesses_number_length check (char_length(btrim(street_number)) between 1 and 20),
  district text constraint businesses_district_length check (char_length(btrim(district)) between 1 and 80),
  city text not null constraint businesses_city_length check (char_length(btrim(city)) between 1 and 80),
  state char(2) not null constraint businesses_state_uf check (
    state in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
              'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')
  ),
  postal_code text constraint businesses_postal_code_format check (postal_code ~ '^[0-9]{8}$'),
  status public.business_status not null default 'pending',
  review_note text constraint businesses_review_note_length check (char_length(review_note) <= 500),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index businesses_owner_idx on public.businesses (owner_id, created_at desc);
create index businesses_directory_idx on public.businesses (state, city, name) where status = 'approved';
create index businesses_review_queue_idx on public.businesses (created_at) where status = 'pending';

comment on table public.businesses is
  'Parceiros. status/review_* só mudam via public.review_business() (admin).';

create trigger businesses_set_updated_at
  before update on public.businesses
  for each row execute function private.set_updated_at();

create function private.validate_business()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Defesa extra: status e revisão nunca vêm do cliente.
    new.status := 'pending';
    new.review_note := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    if (select count(*) from public.businesses b where b.owner_id = new.owner_id) >= 3 then
      raise exception 'Limite de 3 parceiros por usuário atingido' using errcode = 'GH001';
    end if;
  elsif old.status = 'approved' and (new.name is distinct from old.name or new.kind is distinct from old.kind) then
    -- Identidade mudou: precisa de nova conferência.
    new.status := 'pending';
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.review_note := 'Nome ou tipo alterado: aguardando nova conferência.';
  end if;
  return new;
end;
$$;

create trigger businesses_validate
  before insert or update on public.businesses
  for each row execute function private.validate_business();

-- Auditoria de alterações de identidade feitas pelo dono.
create function private.audit_business_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'approved' and new.status = 'pending'
     and (new.name is distinct from old.name or new.kind is distinct from old.kind) then
    perform private.audit('business.resubmitted', 'business', new.id,
      jsonb_build_object('old_name', old.name, 'new_name', new.name,
                         'old_kind', old.kind, 'new_kind', new.kind));
  end if;
  return new;
end;
$$;

create trigger businesses_audit_change
  after update on public.businesses
  for each row execute function private.audit_business_change();

create function private.owns_business(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = p_business_id and b.owner_id = (select auth.uid())
  );
$$;

create function private.owns_business_folder(p_name text)
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
  return private.owns_business(v_parts[2]::uuid);
end;
$$;

revoke all on function private.owns_business(uuid), private.owns_business_folder(text) from public;
grant execute on function private.owns_business(uuid), private.owns_business_folder(text) to authenticated;

alter table public.businesses enable row level security;
revoke all on table public.businesses from anon, authenticated;

-- Público: sem review_note/reviewed_by (ficam para dono/admin via get_business_review()).
grant select (id, owner_id, kind, name, description, phone, phone_is_whatsapp, email, website,
              street, street_number, district, city, state, postal_code, status, reviewed_at,
              created_at, updated_at)
  on table public.businesses to anon, authenticated;
grant insert (kind, name, description, phone, phone_is_whatsapp, email, website,
              street, street_number, district, city, state, postal_code)
  on table public.businesses to authenticated;
grant update (kind, name, description, phone, phone_is_whatsapp, email, website,
              street, street_number, district, city, state, postal_code)
  on table public.businesses to authenticated;
grant delete on table public.businesses to authenticated;

create policy "businesses_select_anon_approved"
  on public.businesses for select
  to anon
  using (status = 'approved');

create policy "businesses_select_authenticated"
  on public.businesses for select
  to authenticated
  using (status = 'approved' or owner_id = (select auth.uid()) or private.is_admin());

create policy "businesses_insert_own"
  on public.businesses for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "businesses_update_own"
  on public.businesses for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "businesses_delete_own"
  on public.businesses for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- business_specialties
-- ---------------------------------------------------------------------------
create table public.business_specialties (
  business_id uuid not null references public.businesses (id) on delete cascade,
  specialty_id text not null references public.specialties (id),
  primary key (business_id, specialty_id)
);

create index business_specialties_specialty_idx on public.business_specialties (specialty_id);

create function private.validate_business_specialty()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.business_specialties s where s.business_id = new.business_id) >= 15 then
    raise exception 'Limite de 15 especialidades por parceiro atingido' using errcode = 'GH001';
  end if;
  return new;
end;
$$;

create trigger business_specialties_validate
  before insert on public.business_specialties
  for each row execute function private.validate_business_specialty();

alter table public.business_specialties enable row level security;
revoke all on table public.business_specialties from anon, authenticated;
grant select on table public.business_specialties to anon, authenticated;
grant insert, delete on table public.business_specialties to authenticated;

-- A subconsulta em businesses aplica a RLS de quem consulta.
create policy "business_specialties_select_visible"
  on public.business_specialties for select
  to anon, authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id));

create policy "business_specialties_insert_own"
  on public.business_specialties for insert
  to authenticated
  with check (private.owns_business(business_id));

create policy "business_specialties_delete_own"
  on public.business_specialties for delete
  to authenticated
  using (private.owns_business(business_id));

-- ---------------------------------------------------------------------------
-- credentials — documentos de registro e certificações
-- ---------------------------------------------------------------------------
create table public.credentials (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  type public.credential_type not null,
  title text not null constraint credentials_title_length check (char_length(btrim(title)) between 2 and 120),
  issuer text constraint credentials_issuer_length check (char_length(btrim(issuer)) between 2 and 120),
  specialty_id text references public.specialties (id),
  issued_on date,
  expires_on date,
  document_path text not null unique,
  status public.credential_status not null default 'pending',
  review_note text constraint credentials_review_note_length check (char_length(review_note) <= 500),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint credentials_dates check (expires_on is null or issued_on is null or expires_on >= issued_on),
  constraint credentials_document_path_format check (
    document_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[A-Za-z0-9_-]{1,64}\.(pdf|jpg|jpeg|png|webp)$'
  )
);

create index credentials_business_idx on public.credentials (business_id, created_at);
create index credentials_review_queue_idx on public.credentials (created_at) where status = 'pending';

create function private.validate_credential()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  new.status := 'pending';
  new.review_note := null;
  new.reviewed_by := null;
  new.reviewed_at := null;

  select b.owner_id into v_owner from public.businesses b where b.id = new.business_id;
  if split_part(new.document_path, '/', 1) <> v_owner::text
     or split_part(new.document_path, '/', 2) <> new.business_id::text then
    raise exception 'Documento fora da pasta do parceiro' using errcode = '23514';
  end if;

  if (select count(*) from public.credentials c where c.business_id = new.business_id) >= 20 then
    raise exception 'Limite de 20 documentos por parceiro atingido' using errcode = 'GH001';
  end if;
  return new;
end;
$$;

create trigger credentials_validate
  before insert on public.credentials
  for each row execute function private.validate_credential();

alter table public.credentials enable row level security;
revoke all on table public.credentials from anon, authenticated;

-- Público: metadados da credencial; nunca o caminho do documento nem a nota de revisão.
grant select (id, business_id, type, title, issuer, specialty_id, issued_on, expires_on,
              status, reviewed_at, created_at)
  on table public.credentials to anon, authenticated;
grant insert (business_id, type, title, issuer, specialty_id, issued_on, expires_on, document_path)
  on table public.credentials to authenticated;
grant delete on table public.credentials to authenticated;

create policy "credentials_select_anon_approved"
  on public.credentials for select
  to anon
  using (status = 'approved' and exists (select 1 from public.businesses b where b.id = business_id));

create policy "credentials_select_authenticated"
  on public.credentials for select
  to authenticated
  using (
    (status = 'approved' and exists (select 1 from public.businesses b where b.id = business_id))
    or private.owns_business(business_id)
    or private.is_admin()
  );

create policy "credentials_insert_own"
  on public.credentials for insert
  to authenticated
  with check (private.owns_business(business_id));

create policy "credentials_delete_own"
  on public.credentials for delete
  to authenticated
  using (private.owns_business(business_id));

-- ---------------------------------------------------------------------------
-- RPCs para dono e admin
-- ---------------------------------------------------------------------------

-- Situação da revisão (com a nota) — só dono ou admin.
create function public.get_business_review(p_business_id uuid)
returns table (status public.business_status, review_note text, reviewed_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.status, b.review_note, b.reviewed_at
  from public.businesses b
  where b.id = p_business_id
    and (b.owner_id = (select auth.uid()) or private.is_admin());
$$;

-- Credenciais com caminho do documento e nota — só dono ou admin.
create function public.get_business_credentials(p_business_id uuid)
returns table (
  id uuid, type public.credential_type, title text, issuer text, specialty_id text,
  issued_on date, expires_on date, document_path text, status public.credential_status,
  review_note text, reviewed_at timestamptz, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.type, c.title, c.issuer, c.specialty_id, c.issued_on, c.expires_on,
         c.document_path, c.status, c.review_note, c.reviewed_at, c.created_at
  from public.credentials c
  join public.businesses b on b.id = c.business_id
  where c.business_id = p_business_id
    and (b.owner_id = (select auth.uid()) or private.is_admin())
  order by c.created_at;
$$;

create function public.review_credential(
  p_credential_id uuid,
  p_decision public.credential_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cred public.credentials;
  v_note text := nullif(btrim(p_note), '');
begin
  if not private.is_admin() then
    raise exception 'Apenas administradores podem revisar documentos' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decisão inválida' using errcode = 'GH001';
  end if;
  if p_decision = 'rejected' and char_length(coalesce(v_note, '')) < 5 then
    raise exception 'Explique o motivo da recusa (mínimo de 5 caracteres)' using errcode = 'GH001';
  end if;

  update public.credentials
     set status = p_decision, review_note = v_note,
         reviewed_by = (select auth.uid()), reviewed_at = now()
   where id = p_credential_id
  returning * into v_cred;

  if not found then
    raise exception 'Documento não encontrado' using errcode = 'P0002';
  end if;

  perform private.audit('credential.' || p_decision::text, 'credential', v_cred.id,
    jsonb_build_object('business_id', v_cred.business_id, 'type', v_cred.type, 'note', v_note));

  -- Sem registro aprovado, um parceiro aprovado volta para conferência.
  if v_cred.type = 'business_registration' and p_decision = 'rejected' and not exists (
    select 1 from public.credentials c
    where c.business_id = v_cred.business_id
      and c.type = 'business_registration' and c.status = 'approved'
  ) then
    update public.businesses
       set status = 'pending', reviewed_by = (select auth.uid()), reviewed_at = now(),
           review_note = 'Documento de registro recusado: aguardando novo documento.'
     where id = v_cred.business_id and status = 'approved';
    if found then
      perform private.audit('business.pending', 'business', v_cred.business_id,
        jsonb_build_object('reason', 'registration_rejected'));
    end if;
  end if;
end;
$$;

create function public.review_business(
  p_business_id uuid,
  p_decision public.business_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text := nullif(btrim(p_note), '');
begin
  if not private.is_admin() then
    raise exception 'Apenas administradores podem revisar parceiros' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected', 'suspended') then
    raise exception 'Decisão inválida' using errcode = 'GH001';
  end if;
  if p_decision in ('rejected', 'suspended') and char_length(coalesce(v_note, '')) < 5 then
    raise exception 'Explique o motivo (mínimo de 5 caracteres)' using errcode = 'GH001';
  end if;
  if not exists (select 1 from public.businesses b where b.id = p_business_id) then
    raise exception 'Parceiro não encontrado' using errcode = 'P0002';
  end if;
  if p_decision = 'approved' and not exists (
    select 1 from public.credentials c
    where c.business_id = p_business_id
      and c.type = 'business_registration' and c.status = 'approved'
  ) then
    raise exception 'Para aprovar, confira e aprove antes um documento de registro (CNPJ/MEI)'
      using errcode = 'GH001';
  end if;

  update public.businesses
     set status = p_decision, review_note = v_note,
         reviewed_by = (select auth.uid()), reviewed_at = now()
   where id = p_business_id;

  perform private.audit('business.' || p_decision::text, 'business', p_business_id,
    jsonb_build_object('note', v_note));
end;
$$;

revoke all on function
  public.get_business_review(uuid),
  public.get_business_credentials(uuid),
  public.review_credential(uuid, public.credential_status, text),
  public.review_business(uuid, public.business_status, text)
  from public, anon;
grant execute on function
  public.get_business_review(uuid),
  public.get_business_credentials(uuid),
  public.review_credential(uuid, public.credential_status, text),
  public.review_business(uuid, public.business_status, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: documentos privados
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('business-documents', 'business-documents', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "business_documents_insert_own"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'business-documents' and private.owns_business_folder(name));

create policy "business_documents_select_owner_or_admin"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'business-documents'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or private.is_admin())
  );

-- Evidência de credencial aprovada não pode ser apagada pelo dono.
-- Função security definer: o cliente não tem grant de leitura em document_path, e uma
-- subconsulta direta na policy faria QUALQUER delete no Storage falhar com 42501
-- (o Postgres checa permissões de todas as policies ao planejar).
create function private.is_approved_document(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.credentials c
    where c.document_path = p_name and c.status = 'approved'
  );
$$;

revoke all on function private.is_approved_document(text) from public;
grant execute on function private.is_approved_document(text) to authenticated;

create policy "business_documents_delete_own_unapproved"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'business-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not private.is_approved_document(name)
  );
