-- Testes da suspensão de contas: permissões, efeitos (sessões, localização), ganchos e Storage.
-- Executar: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

-- A = Ana (será suspensa), B = Bia (usuária comum), M = admin, N = outro admin
insert into auth.users (id, email, raw_user_meta_data) values
  ('a1a1a1a1-0000-4000-8000-00000000000a', 'ana-x@teste.test', '{"username":"ana_x"}'),
  ('a1a1a1a1-0000-4000-8000-00000000000b', 'bia-x@teste.test', '{"username":"bia_x"}'),
  ('a1a1a1a1-0000-4000-8000-00000000000d', 'adm-x@teste.test', '{"username":"adm_x"}'),
  ('a1a1a1a1-0000-4000-8000-00000000000e', 'adm2-x@teste.test', '{"username":"adm2_x"}');
update public.profiles set role = 'admin'
 where id in ('a1a1a1a1-0000-4000-8000-00000000000d', 'a1a1a1a1-0000-4000-8000-00000000000e');

-- Sessão ativa da Ana e um compartilhamento de localização em andamento.
insert into auth.sessions (id, user_id) values ('a2a2a2a2-0000-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-00000000000a');
insert into public.location_sessions (id, owner_id, purpose, expires_at, latitude, longitude, position_at)
values ('a3a3a3a3-0000-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-00000000000a', 'meetup',
        now() + interval '1 hour', -25.43, -49.27, now());

-- Usuária comum não suspende nem lê suspensões.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1a1a1a1-0000-4000-8000-00000000000b","role":"authenticated"}';
select throws_ok(
  $$ select public.admin_suspend_user('a1a1a1a1-0000-4000-8000-00000000000a', 'spam repetido') $$,
  '42501', null, 'não admin não suspende'
);
select throws_ok($$ select * from public.admin_list_suspensions() $$, '42501', null, 'não admin não lista');
select throws_ok($$ select * from public.account_suspensions $$, '42501', null, 'tabela não é legível diretamente');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1a1a1a1-0000-4000-8000-00000000000d","role":"authenticated"}';
select throws_ok(
  $$ select public.admin_suspend_user('a1a1a1a1-0000-4000-8000-00000000000a', 'oi') $$,
  'GH001', null, 'motivo é obrigatório'
);
select throws_ok(
  $$ select public.admin_suspend_user('a1a1a1a1-0000-4000-8000-00000000000d', 'auto suspensão') $$,
  'GH001', null, 'admin não suspende a si mesmo'
);
select throws_ok(
  $$ select public.admin_suspend_user('a1a1a1a1-0000-4000-8000-00000000000e', 'outro admin') $$,
  'GH001', null, 'admin não é suspenso sem antes perder o papel'
);
select throws_ok(
  $$ select public.admin_suspend_user('a1a1a1a1-0000-4000-8000-0000000000ff', 'não existe') $$,
  'P0002', null, 'usuário inexistente'
);
select lives_ok(
  $$ select public.admin_suspend_user('a1a1a1a1-0000-4000-8000-00000000000a', 'Direção perigosa em evento') $$,
  'admin suspende a Ana'
);
select lives_ok(
  $$ select public.admin_suspend_user('a1a1a1a1-0000-4000-8000-00000000000a', 'Motivo atualizado') $$,
  'suspender de novo só atualiza o motivo'
);
select is(
  (select reason from public.admin_list_suspensions() where user_id = 'a1a1a1a1-0000-4000-8000-00000000000a'),
  'Motivo atualizado', 'lista mostra a suspensão com o motivo'
);
reset role;

select is_empty($$ select 1 from auth.sessions where user_id = 'a1a1a1a1-0000-4000-8000-00000000000a' $$, 'sessões encerradas');
select ok(
  (select revoked_at is not null and latitude is null from public.location_sessions where id = 'a3a3a3a3-0000-4000-8000-000000000001'),
  'compartilhamento de localização revogado e posição apagada'
);
select is(
  (select count(*)::int from public.audit_logs where action = 'user.suspended' and entity_id = 'a1a1a1a1-0000-4000-8000-00000000000a'),
  2, 'suspensões auditadas'
);

-- Ganchos
select is(
  hooks.custom_access_token('{"user_id":"a1a1a1a1-0000-4000-8000-00000000000a","claims":{"sub":"x"}}') -> 'error' ->> 'http_code',
  '403', 'Auth não emite token para suspensa'
);
select is(
  hooks.custom_access_token('{"user_id":"a1a1a1a1-0000-4000-8000-00000000000b","claims":{"sub":"y"}}'),
  '{"claims":{"sub":"y"}}'::jsonb, 'demais usuários recebem as claims sem mudança'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1a1a1a1-0000-4000-8000-00000000000a","role":"authenticated"}';
select throws_ok($$ select hooks.check_request() $$, 'GH001', null, 'API recusa requisições da suspensa');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id) values ('vehicle-photos', 'a1a1a1a1-0000-4000-8000-00000000000a/x/y.jpg', 'a1a1a1a1-0000-4000-8000-00000000000a') $$,
  '42501', null, 'suspensa não envia arquivos'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1a1a1a1-0000-4000-8000-00000000000b","role":"authenticated"}';
select lives_ok($$ select hooks.check_request() $$, 'demais usuários passam pelo pre-request');
reset role;

set local role anon;
select lives_ok($$ select hooks.check_request() $$, 'anônimo passa pelo pre-request');
reset role;

-- Reativação
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1a1a1a1-0000-4000-8000-00000000000d","role":"authenticated"}';
select throws_ok(
  $$ select public.admin_unsuspend_user('a1a1a1a1-0000-4000-8000-00000000000a', '') $$,
  'GH001', null, 'reativar exige motivo'
);
select lives_ok(
  $$ select public.admin_unsuspend_user('a1a1a1a1-0000-4000-8000-00000000000a', 'Recurso aceito') $$,
  'admin reativa a Ana'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1a1a1a1-0000-4000-8000-00000000000a","role":"authenticated"}';
select lives_ok($$ select hooks.check_request() $$, 'reativada volta a usar a API');
reset role;

select * from finish();
rollback;
