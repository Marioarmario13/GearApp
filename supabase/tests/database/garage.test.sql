-- Testes da garagem: vehicles, vehicle_private, vehicle_photos e políticas do Storage.
-- Executar: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(35);

-- ---------------------------------------------------------------------------
-- Fixtures (ids fictícios)
--   A = dono, B = outro usuário
--   V1 = veículo público de A, V2 = veículo privado de A
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('bbbbbbbb-0000-4000-8000-00000000000a', 'dono@teste.test'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'outro@teste.test');

select has_table('public', 'vehicles', 'tabela vehicles existe');
select ok(
  (select bool_and(relrowsecurity) from pg_class
   where oid in ('public.vehicles'::regclass, 'public.vehicle_private'::regclass,
                 'public.vehicle_photos'::regclass)),
  'RLS habilitada em vehicles, vehicle_private e vehicle_photos'
);
select is(
  (select public::text || '|' || file_size_limit::text from storage.buckets where id = 'vehicle-photos'),
  'false|5242880', 'bucket vehicle-photos é privado e limitado a 5 MB'
);

-- ---------------------------------------------------------------------------
-- Anônimo
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok($$ select id from public.vehicles $$, '42501', null, 'anon não lê vehicles');
reset role;

-- ---------------------------------------------------------------------------
-- Dono (A)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-4000-8000-00000000000a","role":"authenticated"}';

select lives_ok(
  $$ insert into public.vehicles (make, model, year, visibility)
     values ('Volkswagen', 'Fusca', 1972, 'public') $$,
  'dono cria veículo público'
);
select lives_ok(
  $$ insert into public.vehicles (make, model, year) values ('Fiat', 'Uno', 1995) $$,
  'dono cria veículo (privado por padrão)'
);
select throws_ok(
  $$ insert into public.vehicles (id, make, model, year)
     values ('cccccccc-0000-4000-8000-0000000000ff', 'X', 'Y', 2000) $$,
  '42501', null, 'cliente não escolhe o id do veículo'
);

-- Fixa ids conhecidos para o restante do teste (como postgres, sem dependentes ainda).
reset role;
update public.vehicles set id = 'cccccccc-0000-4000-8000-000000000001' where model = 'Fusca';
update public.vehicles set id = 'cccccccc-0000-4000-8000-000000000002' where model = 'Uno';
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-4000-8000-00000000000a","role":"authenticated"}';
select is(
  (select owner_id::text from public.vehicles where id = 'cccccccc-0000-4000-8000-000000000001'),
  'bbbbbbbb-0000-4000-8000-00000000000a', 'owner_id é preenchido com auth.uid()'
);
select is(
  (select visibility::text from public.vehicles where id = 'cccccccc-0000-4000-8000-000000000002'),
  'private', 'visibilidade padrão é private'
);
select throws_ok(
  $$ insert into public.vehicles (owner_id, make, model, year)
     values ('bbbbbbbb-0000-4000-8000-00000000000b', 'X', 'Y', 2000) $$,
  '42501', null, 'dono não cria veículo em nome de outro usuário'
);
select throws_ok(
  $$ update public.vehicles set owner_id = 'bbbbbbbb-0000-4000-8000-00000000000b'
     where id = 'cccccccc-0000-4000-8000-000000000001' $$,
  '42501', null, 'dono não transfere o veículo (owner_id protegido)'
);
select throws_ok(
  $$ insert into public.vehicles (make, model, year) values ('X', 'Y', 1800) $$,
  '23514', null, 'ano anterior a 1886 é rejeitado'
);
select throws_ok(
  format($$ insert into public.vehicles (make, model, year) values ('X', 'Y', %s) $$,
         extract(year from now())::int + 2),
  '23514', null, 'ano além do próximo ano-modelo é rejeitado'
);
select throws_ok(
  $$ insert into public.vehicles (make, model, year) values ('  ', 'Y', 2000) $$,
  '23514', null, 'marca vazia é rejeitada'
);

select lives_ok(
  $$ insert into public.vehicle_private (vehicle_id, plate)
     values ('cccccccc-0000-4000-8000-000000000001', 'ABC1D23') $$,
  'dono registra a placa'
);
select throws_ok(
  $$ update public.vehicle_private set plate = 'placa' where vehicle_id = 'cccccccc-0000-4000-8000-000000000001' $$,
  '23514', null, 'placa fora do formato é rejeitada'
);

select lives_ok(
  $$ insert into public.vehicle_photos (vehicle_id, storage_path) values
     ('cccccccc-0000-4000-8000-000000000001',
      'bbbbbbbb-0000-4000-8000-00000000000a/cccccccc-0000-4000-8000-000000000001/foto1.jpg'),
     ('cccccccc-0000-4000-8000-000000000002',
      'bbbbbbbb-0000-4000-8000-00000000000a/cccccccc-0000-4000-8000-000000000002/foto2.jpg') $$,
  'dono registra fotos dos próprios veículos'
);
select throws_ok(
  $$ insert into public.vehicle_photos (vehicle_id, storage_path) values
     ('cccccccc-0000-4000-8000-000000000001',
      'bbbbbbbb-0000-4000-8000-00000000000b/cccccccc-0000-4000-8000-000000000001/x.jpg') $$,
  '23514', null, 'caminho de foto fora da pasta do dono é rejeitado'
);

-- Storage
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values
     ('vehicle-photos', 'bbbbbbbb-0000-4000-8000-00000000000a/cccccccc-0000-4000-8000-000000000001/foto1.jpg'),
     ('vehicle-photos', 'bbbbbbbb-0000-4000-8000-00000000000a/cccccccc-0000-4000-8000-000000000002/foto2.jpg') $$,
  'dono envia arquivos para a pasta dos próprios veículos'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values
     ('vehicle-photos', 'bbbbbbbb-0000-4000-8000-00000000000b/cccccccc-0000-4000-8000-000000000001/x.jpg') $$,
  '42501', null, 'dono não envia arquivo para a pasta de outro usuário'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values
     ('vehicle-photos', 'bbbbbbbb-0000-4000-8000-00000000000a/nao-e-uuid/x.jpg') $$,
  '42501', null, 'caminho malformado é negado (sem erro de cast)'
);

-- Limite de veículos: já existem 2; mais 18 chega a 20; o 21º falha.
select lives_ok(
  $$ insert into public.vehicles (make, model, year) select 'Marca', 'Modelo', 2000 from generate_series(1, 18) $$,
  'dono cadastra até 20 veículos'
);
select throws_ok(
  $$ insert into public.vehicles (make, model, year) values ('Marca', 'Modelo', 2000) $$,
  '23514', null, 'o 21º veículo é rejeitado'
);
reset role;

-- ---------------------------------------------------------------------------
-- Outro usuário (B)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-4000-8000-00000000000b","role":"authenticated"}';

select results_eq(
  $$ select id::text from public.vehicles where owner_id = 'bbbbbbbb-0000-4000-8000-00000000000a' and model in ('Fusca', 'Uno') $$,
  $$ values ('cccccccc-0000-4000-8000-000000000001') $$,
  'outro usuário vê só o veículo público do dono'
);
select is_empty(
  $$ select plate from public.vehicle_private $$,
  'outro usuário não vê placas'
);
select throws_ok(
  $$ insert into public.vehicle_private (vehicle_id, plate)
     values ('cccccccc-0000-4000-8000-000000000002', 'XYZ1234') $$,
  '42501', null, 'outro usuário não grava placa em veículo alheio'
);
select lives_ok(
  $$ update public.vehicles set model = 'Hackeado' where id = 'cccccccc-0000-4000-8000-000000000001';
     delete from public.vehicles where id = 'cccccccc-0000-4000-8000-000000000001' $$,
  'update/delete em veículo alheio não gera erro (RLS filtra a linha)...'
);
select throws_ok(
  $$ insert into public.vehicle_photos (vehicle_id, storage_path) values
     ('cccccccc-0000-4000-8000-000000000001',
      'bbbbbbbb-0000-4000-8000-00000000000a/cccccccc-0000-4000-8000-000000000001/intruso.jpg') $$,
  '42501', null, 'outro usuário não registra foto em veículo alheio'
);
select results_eq(
  $$ select storage_path from public.vehicle_photos order by storage_path $$,
  $$ values ('bbbbbbbb-0000-4000-8000-00000000000a/cccccccc-0000-4000-8000-000000000001/foto1.jpg') $$,
  'outro usuário vê apenas fotos de veículos públicos'
);
select results_eq(
  $$ select name from storage.objects where bucket_id = 'vehicle-photos' order by name $$,
  $$ values ('bbbbbbbb-0000-4000-8000-00000000000a/cccccccc-0000-4000-8000-000000000001/foto1.jpg') $$,
  'no Storage, outro usuário lê só arquivos de veículos públicos'
);
reset role;

select is(
  (select model from public.vehicles where id = 'cccccccc-0000-4000-8000-000000000001'),
  'Fusca', '...e o veículo alheio permanece inalterado'
);

-- ---------------------------------------------------------------------------
-- Dono torna o veículo privado → some para terceiros (dados e fotos)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-4000-8000-00000000000a","role":"authenticated"}';
update public.vehicles set visibility = 'private' where id = 'cccccccc-0000-4000-8000-000000000001';
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-4000-8000-00000000000b","role":"authenticated"}';
select is_empty(
  $$ select id from public.vehicles where owner_id = 'bbbbbbbb-0000-4000-8000-00000000000a' $$,
  'após ficar privado, o veículo some para terceiros'
);
select is_empty(
  $$ select name from storage.objects where bucket_id = 'vehicle-photos' $$,
  'após ficar privado, as fotos somem do Storage para terceiros'
);
reset role;

-- ---------------------------------------------------------------------------
-- Exclusão em cascata
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-4000-8000-00000000000a","role":"authenticated"}';
select lives_ok(
  $$ delete from public.vehicles where id = 'cccccccc-0000-4000-8000-000000000001' $$,
  'dono exclui o próprio veículo'
);
reset role;

select is(
  (select count(*)::int from public.vehicle_photos where vehicle_id = 'cccccccc-0000-4000-8000-000000000001')
  + (select count(*)::int from public.vehicle_private where vehicle_id = 'cccccccc-0000-4000-8000-000000000001'),
  0, 'fotos e placa do veículo excluído são removidas em cascata'
);

select * from finish();
rollback;
