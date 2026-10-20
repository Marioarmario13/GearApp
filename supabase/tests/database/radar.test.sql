-- Testes do radar: localização de parceiros (PostGIS) e busca por raio.
-- Executar: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(26);

-- ---------------------------------------------------------------------------
-- Fixtures: O = dono, X = outro usuário, A = admin
--   b_near    aprovado, oficina, especialidade remap, ~0 km do ponto de busca
--   b_mid     aprovado, preparador, ~5 km
--   b_far     aprovado, oficina, ~50 km
--   b_pending pendente, ~0 km (nunca deve aparecer)
-- Ponto de busca: centro de Florianópolis (-27.5954, -48.5480).
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('eeeeeeee-0000-4000-8000-00000000000a', 'dono-radar@teste.test'),
  ('eeeeeeee-0000-4000-8000-00000000000b', 'outro-radar@teste.test'),
  ('eeeeeeee-0000-4000-8000-00000000000c', 'admin-radar@teste.test');
update public.profiles set role = 'admin' where id = 'eeeeeeee-0000-4000-8000-00000000000c';

-- Parceiros criados como postgres (os gatilhos forçam pending; aprovamos em seguida).
insert into public.businesses (id, owner_id, kind, name, city, state) values
  ('ffffffff-0000-4000-8000-000000000001', 'eeeeeeee-0000-4000-8000-00000000000a', 'workshop', 'Perto', 'Florianópolis', 'SC'),
  ('ffffffff-0000-4000-8000-000000000002', 'eeeeeeee-0000-4000-8000-00000000000a', 'tuner', 'Médio', 'Florianópolis', 'SC'),
  ('ffffffff-0000-4000-8000-000000000003', 'eeeeeeee-0000-4000-8000-00000000000b', 'workshop', 'Longe', 'Tijucas', 'SC'),
  ('ffffffff-0000-4000-8000-000000000004', 'eeeeeeee-0000-4000-8000-00000000000b', 'workshop', 'Pendente', 'Florianópolis', 'SC');
insert into public.business_specialties (business_id, specialty_id) values
  ('ffffffff-0000-4000-8000-000000000001', 'remap');
update public.businesses set status = 'approved'
 where id in ('ffffffff-0000-4000-8000-000000000001', 'ffffffff-0000-4000-8000-000000000002',
              'ffffffff-0000-4000-8000-000000000003');

select has_extension('extensions', 'postgis', 'PostGIS habilitado');

-- ---------------------------------------------------------------------------
-- Dono define a localização pela RPC
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"eeeeeeee-0000-4000-8000-00000000000a","role":"authenticated"}';

select lives_ok(
  $$ select public.set_business_location('ffffffff-0000-4000-8000-000000000001', -27.5954, -48.5480);
     select public.set_business_location('ffffffff-0000-4000-8000-000000000002', -27.6400, -48.5480) $$,
  'dono define a localização dos próprios parceiros'
);
select is(
  (select round(latitude::numeric, 4)::text || ',' || round(longitude::numeric, 4)::text
   from public.businesses where id = 'ffffffff-0000-4000-8000-000000000001'),
  '-27.5954,-48.5480', 'latitude/longitude derivadas ficam legíveis'
);
select throws_ok(
  $$ select public.set_business_location('ffffffff-0000-4000-8000-000000000001', 40.7, -74.0) $$,
  'GH001', null, 'localização fora do Brasil é rejeitada'
);
select throws_ok(
  $$ select public.set_business_location('ffffffff-0000-4000-8000-000000000001', -27.5, null) $$,
  'GH001', null, 'latitude sem longitude é rejeitada'
);
select throws_ok(
  $$ select public.set_business_location('ffffffff-0000-4000-8000-000000000003', -27.5, -48.5) $$,
  'P0002', null, 'dono não define localização de parceiro alheio'
);
select throws_ok(
  $$ update public.businesses set location = 'SRID=4326;POINT(-48 -27)'
     where id = 'ffffffff-0000-4000-8000-000000000001' $$,
  '42501', null, 'coluna location não é editável diretamente'
);
select throws_ok(
  $$ update public.businesses set latitude = 0 where id = 'ffffffff-0000-4000-8000-000000000001' $$,
  '428C9', null, 'latitude derivada não é editável'
);
reset role;

select ok(
  exists (select 1 from public.audit_logs where action = 'business.location_changed'
          and entity_id = 'ffffffff-0000-4000-8000-000000000001'),
  'mudança de localização é auditada'
);

-- Localizações dos parceiros do outro usuário.
set local role authenticated;
set local request.jwt.claims = '{"sub":"eeeeeeee-0000-4000-8000-00000000000b","role":"authenticated"}';
select lives_ok(
  $$ select public.set_business_location('ffffffff-0000-4000-8000-000000000003', -27.2400, -48.6300);
     select public.set_business_location('ffffffff-0000-4000-8000-000000000004', -27.5954, -48.5480) $$,
  'outro dono define as próprias localizações'
);
reset role;

-- ---------------------------------------------------------------------------
-- Busca (anônimo)
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok(
  $$ select public.set_business_location('ffffffff-0000-4000-8000-000000000001', -27.5, -48.5) $$,
  '42501', null, 'anônimo não define localização'
);
select results_eq(
  $$ select name from public.search_nearby_businesses(-27.5954, -48.5480, 10)
     where city in ('Florianópolis', 'Tijucas') $$,
  $$ values ('Perto'), ('Médio') $$,
  'busca de 10 km: aprovados dentro do raio, ordenados por distância (pendente excluído)'
);
select ok(
  (select distance_m < 1 from public.search_nearby_businesses(-27.5954, -48.5480, 10) where name = 'Perto'),
  'distância calculada em metros (≈0 para o ponto de origem)'
);
select ok(
  (select distance_m between 4900 and 5100 from public.search_nearby_businesses(-27.5954, -48.5480, 10)
   where name = 'Médio'),
  'distância de ~5 km calculada corretamente'
);
select is(
  (select count(*)::int from public.search_nearby_businesses(-27.5954, -48.5480, 100)
   where city in ('Florianópolis', 'Tijucas')),
  3, 'raio de 100 km inclui o parceiro distante'
);
select results_eq(
  $$ select name from public.search_nearby_businesses(-27.5954, -48.5480, 100, 'tuner')
     where city in ('Florianópolis', 'Tijucas') $$,
  $$ values ('Médio') $$,
  'filtro por tipo'
);
select results_eq(
  $$ select name from public.search_nearby_businesses(-27.5954, -48.5480, 100, null, 'remap')
     where city in ('Florianópolis', 'Tijucas') $$,
  $$ values ('Perto') $$,
  'filtro por especialidade'
);
select is(
  (select specialty_ids from public.search_nearby_businesses(-27.5954, -48.5480, 1) where name = 'Perto'),
  array['remap'], 'resultado traz as especialidades'
);
select throws_ok(
  $$ select * from public.search_nearby_businesses(-27.5, -48.5, 101) $$,
  'GH001', null, 'raio acima de 100 km é rejeitado'
);
select throws_ok(
  $$ select * from public.search_nearby_businesses(-27.5, -48.5, 0) $$,
  'GH001', null, 'raio zero é rejeitado'
);
select throws_ok(
  $$ select * from public.search_nearby_businesses(95, -48.5, 10) $$,
  'GH001', null, 'coordenada inválida é rejeitada'
);
select throws_ok(
  $$ select location from public.businesses $$,
  '42501', null, 'coluna geográfica bruta não é exposta'
);
reset role;

-- Limite de resultados no servidor.
select ok(
  (select count(*) <= 50 from public.search_nearby_businesses(-27.5954, -48.5480, 100, null, null, 1000)),
  'quantidade de resultados limitada a 50 mesmo pedindo mais'
);

-- Remover a localização tira o parceiro do radar.
set local role authenticated;
set local request.jwt.claims = '{"sub":"eeeeeeee-0000-4000-8000-00000000000a","role":"authenticated"}';
select lives_ok(
  $$ select public.set_business_location('ffffffff-0000-4000-8000-000000000002') $$,
  'dono remove a localização'
);
select is_empty(
  $$ select 1 from public.search_nearby_businesses(-27.5954, -48.5480, 10) where name = 'Médio' $$,
  'parceiro sem localização sai do radar'
);
reset role;

-- A consulta de raio (mesma forma usada na RPC) consegue usar o índice GiST parcial.
create function pg_temp.plan_of(q text) returns setof text language plpgsql as $f$
declare r record;
begin
  for r in execute 'explain ' || q loop return next r."QUERY PLAN"; end loop;
end $f$;

-- Com tabelas minúsculas o planejador empata custos com o outro índice parcial
-- (businesses_directory_idx); removê-lo dentro da transação (desfeita no rollback)
-- deixa o teste determinístico.
drop index public.businesses_directory_idx;
set local enable_seqscan = off;
select ok(
  exists (
    select 1 from pg_temp.plan_of($$
      select b.id from public.businesses b
      where b.status = 'approved' and b.location is not null
        and extensions.st_dwithin(
          b.location,
          extensions.st_setsrid(extensions.st_makepoint(-48.548, -27.5954), 4326)::extensions.geography,
          10000)
    $$) as line
    where line like '%Index Cond%location && %'
  ),
  'busca por raio usa o índice GiST'
);
reset enable_seqscan;

select * from finish();
rollback;
