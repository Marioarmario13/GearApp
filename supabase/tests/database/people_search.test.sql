-- Testes da busca de pessoas: limites, curingas, bloqueios e acesso anônimo.
-- Executar: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, email, raw_user_meta_data) values
  ('e7e7e7e7-0000-4000-8000-00000000000a', 'ana-s@teste.test', '{"username":"ana_busca","display_name":"Ana Turbo"}'),
  ('e7e7e7e7-0000-4000-8000-00000000000b', 'bia-s@teste.test', '{"username":"bia_busca","display_name":"Bia Opala"}'),
  ('e7e7e7e7-0000-4000-8000-00000000000c', 'caio-s@teste.test', '{"username":"caiobusca","display_name":"Caio"}');

set local role authenticated;
set local request.jwt.claims = '{"sub":"e7e7e7e7-0000-4000-8000-00000000000a","role":"authenticated"}';
select is(
  (select array_agg(username order by username) from public.search_profiles('busca')),
  array['bia_busca', 'caiobusca'],
  'encontra por trecho do username e não inclui a si mesmo'
);
select is((select username from public.search_profiles('OPALA')), 'bia_busca', 'busca pelo nome de exibição, sem diferenciar maiúsculas');
select is(
  (select array_agg(username) from public.search_profiles('a_b')),
  array['bia_busca'],
  '"_" é literal, não curinga'
);
select is_empty($$ select * from public.search_profiles('%%%') $$, '"%" é literal, não lista todos');
select throws_ok($$ select * from public.search_profiles('ab') $$, 'GH001', null, 'termo curto é recusado');
select throws_ok($$ select * from public.search_profiles(repeat('a', 31)) $$, 'GH001', null, 'termo longo é recusado');
reset role;

-- Bia bloqueia Ana: nenhuma das duas encontra a outra.
insert into public.blocks (blocker_id, blocked_id)
values ('e7e7e7e7-0000-4000-8000-00000000000b', 'e7e7e7e7-0000-4000-8000-00000000000a');

set local role authenticated;
set local request.jwt.claims = '{"sub":"e7e7e7e7-0000-4000-8000-00000000000a","role":"authenticated"}';
select is_empty($$ select * from public.search_profiles('bia_busca') $$, 'bloqueada não encontra quem bloqueou');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"e7e7e7e7-0000-4000-8000-00000000000b","role":"authenticated"}';
select is_empty($$ select * from public.search_profiles('ana_busca') $$, 'quem bloqueou não encontra a bloqueada');
select is((select count(*)::int from public.search_profiles('caio')), 1, 'demais perfis seguem visíveis');
reset role;

set local role anon;
select throws_ok($$ select * from public.search_profiles('busca') $$, '42501', null, 'anônimo não busca pessoas');
reset role;

select * from finish();
rollback;
