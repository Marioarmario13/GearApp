-- Testes da comunidade: amizades, bloqueios aplicados no backend, denúncias e moderação.
-- Executar: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(32);

-- A = Ana, B = Bia, C = Caio, M = admin
insert into auth.users (id, email, raw_user_meta_data) values
  ('c3c3c3c3-0000-4000-8000-00000000000a', 'ana-c@teste.test', '{"username":"ana_c"}'),
  ('c3c3c3c3-0000-4000-8000-00000000000b', 'bia-c@teste.test', '{"username":"bia_c"}'),
  ('c3c3c3c3-0000-4000-8000-00000000000c', 'caio-c@teste.test', '{"username":"caio_c"}'),
  ('c3c3c3c3-0000-4000-8000-00000000000d', 'adm-c@teste.test', '{"username":"adm_c"}');
update public.profiles set role = 'admin' where id = 'c3c3c3c3-0000-4000-8000-00000000000d';

-- Veículo público da Ana e evento futuro organizado pela Ana.
insert into public.vehicles (id, owner_id, make, model, year, visibility) values
  ('c4c4c4c4-0000-4000-8000-000000000001', 'c3c3c3c3-0000-4000-8000-00000000000a', 'VW', 'Gol', 1990, 'public');
insert into public.events (id, organizer_id, kind, title, starts_at, ends_at, venue_name, city, state) values
  ('c5c5c5c5-0000-4000-8000-000000000001', 'c3c3c3c3-0000-4000-8000-00000000000a', 'meetup', 'Encontro da Ana',
   now() + interval '3 days', now() + interval '3 days 2 hours', 'Praça', 'Recife', 'PE');

-- ---------------------------------------------------------------------------
-- Amizade
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"c3c3c3c3-0000-4000-8000-00000000000b","role":"authenticated"}';
select is(public.send_friend_request('c3c3c3c3-0000-4000-8000-00000000000a')::text, 'pending', 'Bia pede amizade à Ana');
select is(public.send_friend_request('c3c3c3c3-0000-4000-8000-00000000000a')::text, 'pending', 'pedido repetido é idempotente');
select throws_ok($$ select public.send_friend_request('c3c3c3c3-0000-4000-8000-00000000000b') $$, 'GH001', null, 'não é possível pedir a si mesmo');
select throws_ok(
  $$ insert into public.friendships (requester_id, addressee_id) values ('c3c3c3c3-0000-4000-8000-00000000000b', 'c3c3c3c3-0000-4000-8000-00000000000c') $$,
  '42501', null, 'amizade não é inserida diretamente'
);
select throws_ok(
  $$ select public.respond_friend_request((select id from public.friendships limit 1), true) $$,
  'P0002', null, 'quem pediu não pode aceitar o próprio pedido'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"c3c3c3c3-0000-4000-8000-00000000000c","role":"authenticated"}';
select is_empty($$ select id from public.friendships $$, 'terceiros não veem o pedido');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"c3c3c3c3-0000-4000-8000-00000000000a","role":"authenticated"}';
select is((select incoming::text from public.my_friendships()), 'true', 'Ana vê o pedido recebido');
select lives_ok(
  $$ select public.respond_friend_request((select friendship_id from public.my_friendships()), true) $$,
  'Ana aceita o pedido'
);
select is((select status::text from public.my_friendships()), 'accepted', 'amizade aceita');
reset role;

-- Pedido cruzado vira amizade direto (Caio → Ana, Ana → Caio).
set local role authenticated;
set local request.jwt.claims = '{"sub":"c3c3c3c3-0000-4000-8000-00000000000c","role":"authenticated"}';
select is(public.send_friend_request('c3c3c3c3-0000-4000-8000-00000000000a')::text, 'pending', 'Caio pede amizade à Ana');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"c3c3c3c3-0000-4000-8000-00000000000a","role":"authenticated"}';
select is(public.send_friend_request('c3c3c3c3-0000-4000-8000-00000000000c')::text, 'accepted', 'pedido cruzado vira amizade');
reset role;

-- ---------------------------------------------------------------------------
-- Bloqueio (Ana bloqueia Caio) aplicado no backend
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"c3c3c3c3-0000-4000-8000-00000000000c","role":"authenticated"}';
select is(public.rsvp_event('c5c5c5c5-0000-4000-8000-000000000001'), 1, 'Caio confirma no evento da Ana (antes do bloqueio)');
select is((select count(*)::int from public.vehicles where owner_id = 'c3c3c3c3-0000-4000-8000-00000000000a'), 1, 'Caio vê o veículo público da Ana');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"c3c3c3c3-0000-4000-8000-00000000000a","role":"authenticated"}';
select lives_ok($$ select public.block_user('c3c3c3c3-0000-4000-8000-00000000000c') $$, 'Ana bloqueia Caio');
select throws_ok(
  $$ insert into public.blocks (blocker_id, blocked_id) values ('c3c3c3c3-0000-4000-8000-00000000000a', 'c3c3c3c3-0000-4000-8000-00000000000b') $$,
  '42501', null, 'bloqueio não é inserido diretamente'
);
select is((select count(*)::int from public.my_blocks()), 1, 'Ana vê quem bloqueou');
reset role;

select is(
  (select count(*)::int from public.friendships where 'c3c3c3c3-0000-4000-8000-00000000000c' in (requester_id, addressee_id)),
  0, 'bloquear desfaz a amizade'
);
select is(
  (select attendee_count from public.events where id = 'c5c5c5c5-0000-4000-8000-000000000001'),
  0, 'bloquear retira a presença do bloqueado no evento da Ana'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"c3c3c3c3-0000-4000-8000-00000000000c","role":"authenticated"}';
select is_empty($$ select id from public.profiles where id = 'c3c3c3c3-0000-4000-8000-00000000000a' $$, 'bloqueado não vê o perfil de quem bloqueou');
select is_empty($$ select id from public.vehicles where owner_id = 'c3c3c3c3-0000-4000-8000-00000000000a' $$, 'bloqueado não vê veículos públicos de quem bloqueou');
select is_empty($$ select blocker_id from public.blocks $$, 'bloqueado não sabe que foi bloqueado');
select throws_ok(
  $$ select public.send_friend_request('c3c3c3c3-0000-4000-8000-00000000000a') $$,
  'P0002', null, 'bloqueado não pede amizade (resposta neutra)'
);
select throws_ok(
  $$ select public.rsvp_event('c5c5c5c5-0000-4000-8000-000000000001') $$,
  'GH001', null, 'bloqueado não confirma presença nos eventos de quem bloqueou'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"c3c3c3c3-0000-4000-8000-00000000000a","role":"authenticated"}';
select is_empty($$ select id from public.profiles where id = 'c3c3c3c3-0000-4000-8000-00000000000c' $$, 'quem bloqueou também deixa de ver o bloqueado');
select lives_ok($$ select public.unblock_user('c3c3c3c3-0000-4000-8000-00000000000c') $$, 'Ana desbloqueia Caio');
select is((select count(*)::int from public.profiles where id = 'c3c3c3c3-0000-4000-8000-00000000000c'), 1, 'após desbloqueio o perfil volta a aparecer');
reset role;

-- ---------------------------------------------------------------------------
-- Denúncias e moderação
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"c3c3c3c3-0000-4000-8000-00000000000b","role":"authenticated"}';
select lives_ok(
  $$ insert into public.reports (target_type, target_id, reason, details)
     values ('vehicle', 'c4c4c4c4-0000-4000-8000-000000000001', 'offensive', 'Foto ofensiva') $$,
  'Bia denuncia um veículo'
);
select throws_ok(
  $$ insert into public.reports (target_type, target_id, reason)
     values ('vehicle', 'c4c4c4c4-0000-4000-8000-000000000001', 'spam') $$,
  '23505', null, 'denúncia duplicada aberta é rejeitada'
);
select throws_ok(
  $$ select public.resolve_report((select id from public.reports where target_id = 'c4c4c4c4-0000-4000-8000-000000000001'), 'resolved', 'ok') $$,
  '42501', null, 'usuário comum não resolve denúncias'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"c3c3c3c3-0000-4000-8000-00000000000c","role":"authenticated"}';
select is_empty($$ select id from public.reports $$, 'denúncias de outros não são visíveis');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"c3c3c3c3-0000-4000-8000-00000000000d","role":"authenticated"}';
select lives_ok(
  $$ select public.moderate_hide_vehicle('c4c4c4c4-0000-4000-8000-000000000001', 'Conteúdo ofensivo');
     select public.resolve_report((select id from public.admin_list_reports() where target_id = 'c4c4c4c4-0000-4000-8000-000000000001'), 'resolved', 'Veículo ocultado') $$,
  'admin oculta o veículo e resolve a denúncia'
);
reset role;
select is(
  (select string_agg(action, ',' order by action) from public.audit_logs
   where entity_id in ('c4c4c4c4-0000-4000-8000-000000000001',
                      (select id from public.reports where target_id = 'c4c4c4c4-0000-4000-8000-000000000001'))),
  'report.resolved,vehicle.hidden', 'moderação registrada na auditoria'
);

select * from finish();
rollback;
