-- Testes do GPS social: sessões temporárias, destinatários autorizados, revogação,
-- expiração, ausência de histórico, bloqueios e presença aproximada.
-- Executar: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(31);

-- A = Ana (compartilha), B = Bia (amiga), C = Caio (amigo, depois bloqueado), D = Duda (não amiga)
insert into auth.users (id, email) values
  ('d6d6d6d6-0000-4000-8000-00000000000a', 'ana-g@teste.test'),
  ('d6d6d6d6-0000-4000-8000-00000000000b', 'bia-g@teste.test'),
  ('d6d6d6d6-0000-4000-8000-00000000000c', 'caio-g@teste.test'),
  ('d6d6d6d6-0000-4000-8000-00000000000d', 'duda-g@teste.test');
insert into public.friendships (requester_id, addressee_id, status) values
  ('d6d6d6d6-0000-4000-8000-00000000000a', 'd6d6d6d6-0000-4000-8000-00000000000b', 'accepted'),
  ('d6d6d6d6-0000-4000-8000-00000000000c', 'd6d6d6d6-0000-4000-8000-00000000000a', 'accepted');

create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;

select ok(
  (select bool_and(relrowsecurity) from pg_class where oid in (
    'public.location_sessions'::regclass, 'public.location_session_recipients'::regclass,
    'public.ephemeral_presence'::regclass)),
  'RLS habilitada nas tabelas de localização'
);

-- ---------------------------------------------------------------------------
-- Ana inicia sessão para Bia e Caio
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"d6d6d6d6-0000-4000-8000-00000000000a","role":"authenticated"}';
select throws_ok($$ select id from public.location_sessions $$, '42501', null, 'tabela de sessões não é legível diretamente');
select throws_ok($$ select user_id from public.ephemeral_presence $$, '42501', null, 'tabela de presença não é legível diretamente');
select throws_ok(
  $$ select public.start_location_session('meetup', 60, array['d6d6d6d6-0000-4000-8000-00000000000d']::uuid[]) $$,
  'GH001', null, 'não compartilha com quem não é amigo'
);
select throws_ok(
  $$ select public.start_location_session('meetup', 600, array['d6d6d6d6-0000-4000-8000-00000000000b']::uuid[]) $$,
  'GH001', null, 'duração acima de 8 horas é rejeitada'
);
select throws_ok(
  $$ select public.start_location_session('meetup', 60, '{}'::uuid[]) $$,
  'GH001', null, 'sessão sem destinatários é rejeitada'
);
select lives_ok(
  $$ insert into ids select 's1', public.start_location_session('convoy', 60,
       array['d6d6d6d6-0000-4000-8000-00000000000b', 'd6d6d6d6-0000-4000-8000-00000000000c']::uuid[], 'Comboio para a serra') $$,
  'Ana inicia sessão para amigos'
);
select is((select count(*)::int from public.my_location_session()), 1, 'Ana vê a própria sessão ativa');
select ok(
  public.update_session_location((select id from ids where name = 's1'), -25.4284, -49.2733, 15) is not null,
  'Ana envia a posição'
);
select is(
  (select position_at from public.my_location_session()),
  public.update_session_location((select id from ids where name = 's1'), -25.5, -49.5, 15),
  'atualização em menos de 30 s é ignorada (sem erro)'
);
reset role;

select is(
  (select latitude::text from public.location_sessions where id = (select id from ids where name = 's1')),
  '-25.4284', 'só a última posição aceita fica gravada (sem histórico)'
);

-- ---------------------------------------------------------------------------
-- Quem vê
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"d6d6d6d6-0000-4000-8000-00000000000b","role":"authenticated"}';
select is(
  (select latitude::text || ',' || longitude::text from public.shared_locations_for_me()),
  '-25.4284,-49.2733', 'destinatária autorizada vê a posição exata'
);
select throws_ok(
  $$ select public.update_session_location((select id from ids where name = 's1'), -25.0, -49.0) $$,
  'GH001', null, 'destinatária não altera a posição de outra pessoa'
);
select throws_ok(
  $$ select public.stop_location_session((select id from ids where name = 's1')) $$,
  'P0002', null, 'destinatária não encerra a sessão de outra pessoa'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"d6d6d6d6-0000-4000-8000-00000000000d","role":"authenticated"}';
select is_empty($$ select * from public.shared_locations_for_me() $$, 'não destinatária não vê nada');
reset role;

set local role anon;
select throws_ok($$ select * from public.shared_locations_for_me() $$, '42501', null, 'anônimo não acessa localizações');
reset role;

-- Bloqueio corta o acesso imediatamente (Caio bloqueia Ana).
set local role authenticated;
set local request.jwt.claims = '{"sub":"d6d6d6d6-0000-4000-8000-00000000000c","role":"authenticated"}';
select is((select count(*)::int from public.shared_locations_for_me()), 1, 'Caio vê enquanto é amigo');
select lives_ok($$ select public.block_user('d6d6d6d6-0000-4000-8000-00000000000a') $$, 'Caio bloqueia Ana');
select is_empty($$ select * from public.shared_locations_for_me() $$, 'após o bloqueio, não vê mais a posição');
reset role;
select is(
  (select count(*)::int from public.location_session_recipients where session_id = (select id from ids where name = 's1')),
  1, 'bloqueio remove o destinatário da sessão'
);

-- ---------------------------------------------------------------------------
-- Revogação e expiração
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"d6d6d6d6-0000-4000-8000-00000000000a","role":"authenticated"}';
select lives_ok($$ select public.stop_location_session((select id from ids where name = 's1')) $$, 'Ana revoga a sessão');
reset role;
select is(
  (select latitude from public.location_sessions where id = (select id from ids where name = 's1')),
  null, 'revogar apaga a posição na hora'
);
set local role authenticated;
set local request.jwt.claims = '{"sub":"d6d6d6d6-0000-4000-8000-00000000000b","role":"authenticated"}';
select is_empty($$ select * from public.shared_locations_for_me() $$, 'sessão revogada deixa de compartilhar');
reset role;

-- Nova sessão que expira.
set local role authenticated;
set local request.jwt.claims = '{"sub":"d6d6d6d6-0000-4000-8000-00000000000a","role":"authenticated"}';
select lives_ok(
  $$ insert into ids select 's2', public.start_location_session('safety', 30, array['d6d6d6d6-0000-4000-8000-00000000000b']::uuid[]);
     select public.update_session_location((select id from ids where name = 's2'), -25.43, -49.27) $$,
  'Ana abre outra sessão e envia posição'
);
reset role;
-- Simula o tempo passando (como postgres): a sessão venceu há 1 minuto.
update public.location_sessions
   set started_at = now() - interval '2 hours', expires_at = now() - interval '1 minute'
 where id = (select id from ids where name = 's2');
set local role authenticated;
set local request.jwt.claims = '{"sub":"d6d6d6d6-0000-4000-8000-00000000000b","role":"authenticated"}';
select is_empty($$ select * from public.shared_locations_for_me() $$, 'sessão expirada deixa de compartilhar');
reset role;
select is(
  (select latitude from public.location_sessions where id = (select id from ids where name = 's2')),
  null, 'posição de sessão expirada é apagada na limpeza'
);
set local role authenticated;
set local request.jwt.claims = '{"sub":"d6d6d6d6-0000-4000-8000-00000000000a","role":"authenticated"}';
select throws_ok(
  $$ select public.update_session_location((select id from ids where name = 's2'), -25.43, -49.27) $$,
  'GH001', null, 'sessão expirada não aceita novas posições'
);
reset role;

-- ---------------------------------------------------------------------------
-- Presença aproximada
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"d6d6d6d6-0000-4000-8000-00000000000b","role":"authenticated"}';
select lives_ok($$ select public.set_presence(-25.4284, -49.2733, 60) $$, 'Bia aparece para amigos por 1 hora');
reset role;
select is(
  (select cell_lat::text || ',' || cell_lng::text from public.ephemeral_presence
   where user_id = 'd6d6d6d6-0000-4000-8000-00000000000b'),
  '-25.45,-49.25', 'presença guarda só a célula grosseira'
);
set local role authenticated;
set local request.jwt.claims = '{"sub":"d6d6d6d6-0000-4000-8000-00000000000a","role":"authenticated"}';
select is(
  (select distance_band from public.nearby_friends(-25.43, -49.27)),
  'até 5 km', 'amiga aparece com faixa de distância, sem coordenadas'
);
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"d6d6d6d6-0000-4000-8000-00000000000d","role":"authenticated"}';
select is_empty($$ select * from public.nearby_friends(-25.43, -49.27) $$, 'quem não é amigo não descobre a presença');
reset role;

select * from finish();
rollback;
