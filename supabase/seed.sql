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
