-- Dados FICTÍCIOS para desenvolvimento local. Nunca use dados reais aqui.
-- Aplicado por `npx supabase db reset`.
--
-- Usuários de teste (senha de ambos: Gearhead123):
--   admin@gearhead.test  — administrador
--   piloto@gearhead.test — usuário comum

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  (
    '00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111',
    'authenticated', 'authenticated', 'admin@gearhead.test',
    extensions.crypt('Gearhead123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"admin_gearhead","display_name":"Admin Gearhead"}',
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222',
    'authenticated', 'authenticated', 'piloto@gearhead.test',
    extensions.crypt('Gearhead123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"piloto_teste","display_name":"Piloto de Teste"}',
    now(), now(), '', '', '', ''
  );

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.email in ('admin@gearhead.test', 'piloto@gearhead.test');

update public.profiles
set role = 'admin', city = 'São Paulo', state = 'SP'
where id = '11111111-1111-4111-8111-111111111111';

update public.profiles
set city = 'Curitiba', state = 'PR'
where id = '22222222-2222-4222-8222-222222222222';

-- ---------------------------------------------------------------------------
-- Parceiros fictícios (Etapa 4). Os documentos referenciados não existem no
-- Storage local: servem só para exercitar a listagem e o painel admin.
-- ---------------------------------------------------------------------------
insert into public.businesses (id, owner_id, kind, name, description, phone, phone_is_whatsapp,
                               street, street_number, district, city, state, postal_code)
values
  ('33333333-3333-4333-8333-333333333331', '22222222-2222-4222-8222-222222222222', 'workshop',
   'Oficina Exemplo Turbo', 'Oficina fictícia para desenvolvimento: injeção e preparação.',
   '41999990000', true, 'Rua Fictícia', '100', 'Centro', 'Curitiba', 'PR', '80000000'),
  ('33333333-3333-4333-8333-333333333332', '22222222-2222-4222-8222-222222222222', 'detailing',
   'Estética Teste Brilho', 'Cadastro fictício aguardando conferência.',
   '41988880000', false, null, null, null, 'Curitiba', 'PR', null)
on conflict (id) do nothing;

insert into public.business_specialties (business_id, specialty_id) values
  ('33333333-3333-4333-8333-333333333331', 'injecao-eletronica'),
  ('33333333-3333-4333-8333-333333333331', 'preparacao-motor'),
  ('33333333-3333-4333-8333-333333333332', 'estetica')
on conflict do nothing;

insert into public.credentials (id, business_id, type, title, issuer, document_path) values
  ('44444444-4444-4444-8444-444444444441', '33333333-3333-4333-8333-333333333331',
   'business_registration', 'Comprovante de CNPJ (fictício)', 'Receita Federal',
   '22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333331/cnpj-ficticio.pdf'),
  ('44444444-4444-4444-8444-444444444442', '33333333-3333-4333-8333-333333333331',
   'certification', 'Curso de injeção eletrônica (fictício)', 'Escola Técnica Exemplo',
   '22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333331/curso-ficticio.pdf'),
  ('44444444-4444-4444-8444-444444444443', '33333333-3333-4333-8333-333333333332',
   'business_registration', 'Certificado MEI (fictício)', 'Portal do Empreendedor',
   '22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333332/mei-ficticio.pdf')
on conflict (id) do nothing;

-- Conferência simulada pelo admin do seed (fora das RPCs, então registra a auditoria aqui).
update public.credentials
   set status = 'approved', reviewed_by = '11111111-1111-4111-8111-111111111111', reviewed_at = now()
 where id in ('44444444-4444-4444-8444-444444444441', '44444444-4444-4444-8444-444444444442')
   and status = 'pending';
update public.businesses
   set status = 'approved', reviewed_by = '11111111-1111-4111-8111-111111111111', reviewed_at = now()
 where id = '33333333-3333-4333-8333-333333333331' and status = 'pending';
insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
select '11111111-1111-4111-8111-111111111111', 'business.approved', 'business',
       '33333333-3333-4333-8333-333333333331', '{"note":"seed"}'
where not exists (
  select 1 from public.audit_logs where entity_id = '33333333-3333-4333-8333-333333333331'
);

-- Localização fictícia dos parceiros do seed (Etapa 5) — região central de Curitiba.
update public.businesses
   set location = extensions.st_setsrid(extensions.st_makepoint(-49.2733, -25.4284), 4326)::extensions.geography
 where id = '33333333-3333-4333-8333-333333333331' and location is null;
update public.businesses
   set location = extensions.st_setsrid(extensions.st_makepoint(-49.2900, -25.4400), 4326)::extensions.geography
 where id = '33333333-3333-4333-8333-333333333332' and location is null;

-- Evento e oferta fictícios (Etapa 6). Datas relativas a quando o seed roda.
insert into public.events (id, organizer_id, business_id, kind, title, description, starts_at, ends_at,
                           venue_name, city, state, capacity)
values ('55555555-5555-4555-8555-555555555551', '22222222-2222-4222-8222-222222222222',
        '33333333-3333-4333-8333-333333333331', 'meetup', 'Encontro de Clássicos (fictício)',
        'Encontro fictício para desenvolvimento. Estacionamento, sem manobras arriscadas.',
        date_trunc('day', now()) + interval '14 days 9 hours', date_trunc('day', now()) + interval '14 days 13 hours',
        'Estacionamento Exemplo', 'Curitiba', 'PR', 50)
on conflict (id) do nothing;
update public.events
   set location = extensions.st_setsrid(extensions.st_makepoint(-49.2700, -25.4300), 4326)::extensions.geography
 where id = '55555555-5555-4555-8555-555555555551' and location is null;

insert into public.offers (id, business_id, title, description, discount_label, terms, ends_at, max_redemptions, per_user_limit)
values ('66666666-6666-4666-8666-666666666661', '33333333-3333-4333-8333-333333333331',
        'Revisão de injeção com desconto (fictício)', 'Oferta fictícia para desenvolvimento.',
        '15% OFF', 'Válido de segunda a sexta. Não cumulativo.', now() + interval '60 days', 100, 1)
on conflict (id) do nothing;
