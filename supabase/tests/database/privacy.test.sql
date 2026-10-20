-- Testes de direitos do titular: exportação dos próprios dados e exclusão da conta.
-- Executar: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(13);

-- U = usuária que exporta/exclui, O = outra pessoa, M = admin único do teste
insert into auth.users (id, email, raw_user_meta_data) values
  ('e7e7e7e7-0000-4000-8000-00000000000a', 'titular@teste.test', '{"username":"titular_t"}'),
  ('e7e7e7e7-0000-4000-8000-00000000000b', 'outra@teste.test', '{"username":"outra_t"}');
insert into public.vehicles (id, owner_id, make, model, year) values
  ('e8e8e8e8-0000-4000-8000-000000000001', 'e7e7e7e7-0000-4000-8000-00000000000a', 'Fiat', 'Uno', 1995),
  ('e8e8e8e8-0000-4000-8000-000000000002', 'e7e7e7e7-0000-4000-8000-00000000000b', 'VW', 'Gol', 1990);
insert into public.vehicle_private (vehicle_id, plate) values ('e8e8e8e8-0000-4000-8000-000000000001', 'ABC1D23');
insert into public.friendships (requester_id, addressee_id, status) values
  ('e7e7e7e7-0000-4000-8000-00000000000a', 'e7e7e7e7-0000-4000-8000-00000000000b', 'accepted');

-- ---------------------------------------------------------------------------
-- Exportação
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok($$ select public.export_my_data() $$, '42501', null, 'anônimo não exporta dados');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"e7e7e7e7-0000-4000-8000-00000000000a","role":"authenticated"}';
select is((public.export_my_data() -> 'conta' ->> 'email'), 'titular@teste.test', 'exportação inclui a conta');
select is((public.export_my_data() -> 'perfil' ->> 'username'), 'titular_t', 'exportação inclui o perfil');
select ok(not (public.export_my_data() -> 'perfil' ? 'role'), 'exportação não expõe o papel interno');
select is(jsonb_array_length(public.export_my_data() -> 'veiculos'), 1, 'exportação traz só os próprios veículos');
select is((public.export_my_data() -> 'veiculos' -> 0 ->> 'placa'), 'ABC1D23', 'exportação inclui a placa (dado do próprio titular)');
select is(jsonb_array_length(public.export_my_data() -> 'amizades'), 1, 'exportação inclui vínculos de amizade');

-- ---------------------------------------------------------------------------
-- Exclusão
-- ---------------------------------------------------------------------------
select throws_ok($$ select public.delete_my_account('sim') $$, 'GH001', null, 'exclusão exige confirmação explícita');
select lives_ok($$ select public.delete_my_account('EXCLUIR') $$, 'titular exclui a própria conta');
reset role;

select is((select count(*)::int from auth.users where id = 'e7e7e7e7-0000-4000-8000-00000000000a'), 0, 'conta removida do Auth');
select is(
  (select count(*)::int from public.vehicles where owner_id = 'e7e7e7e7-0000-4000-8000-00000000000a')
  + (select count(*)::int from public.friendships where 'e7e7e7e7-0000-4000-8000-00000000000a' in (requester_id, addressee_id))
  + (select count(*)::int from public.profiles where id = 'e7e7e7e7-0000-4000-8000-00000000000a'),
  0, 'dados pessoais removidos em cascata'
);
select ok(
  exists (select 1 from public.audit_logs where action = 'account.deleted'
          and entity_id = 'e7e7e7e7-0000-4000-8000-00000000000a' and actor_id is null),
  'auditoria registra a exclusão sem manter o vínculo pessoal'
);

-- Único admin não pode se excluir. (Neste teste, o único admin é M; os admins do seed
-- e de outros testes são rebaixados dentro da transação para isolar o cenário.)
insert into auth.users (id, email) values ('e7e7e7e7-0000-4000-8000-00000000000c', 'adm-unico@teste.test');
update public.profiles set role = 'user' where role = 'admin';
update public.profiles set role = 'admin' where id = 'e7e7e7e7-0000-4000-8000-00000000000c';
set local role authenticated;
set local request.jwt.claims = '{"sub":"e7e7e7e7-0000-4000-8000-00000000000c","role":"authenticated"}';
select throws_ok($$ select public.delete_my_account('EXCLUIR') $$, 'GH001', null, 'único administrador não exclui a própria conta');
reset role;

select * from finish();
rollback;
