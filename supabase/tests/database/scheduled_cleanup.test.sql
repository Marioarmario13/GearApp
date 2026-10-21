-- Testes das limpezas agendadas e da listagem de arquivos órfãos.
-- Executar: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

select is(
  (select schedule from cron.job where jobname = 'purge-expired-locations'),
  '*/10 * * * *',
  'limpeza de localizações agendada a cada 10 min'
);
select is(
  (select command from cron.job where jobname = 'purge-expired-locations'),
  'select private.purge_expired_locations()',
  'job chama a função de limpeza'
);
select isnt_empty(
  $$ select 1 from cron.job where jobname = 'purge-cron-history' $$,
  'histórico do pg_cron é podado'
);

-- Órfãos: um arquivo antigo sem linha, um recente sem linha e um com linha.
insert into auth.users (id, email) values ('f8f8f8f8-0000-4000-8000-00000000000a', 'orfao@teste.test');
insert into public.vehicles (id, owner_id, make, model, year)
values ('f9f9f9f9-0000-4000-8000-000000000001', 'f8f8f8f8-0000-4000-8000-00000000000a', 'VW', 'Fusca', 1970);
insert into storage.objects (bucket_id, name, owner_id, created_at) values
  ('vehicle-photos', 'f8f8f8f8-0000-4000-8000-00000000000a/f9f9f9f9-0000-4000-8000-000000000001/velho.jpg',
   'f8f8f8f8-0000-4000-8000-00000000000a', now() - interval '3 days'),
  ('vehicle-photos', 'f8f8f8f8-0000-4000-8000-00000000000a/f9f9f9f9-0000-4000-8000-000000000001/novo.jpg',
   'f8f8f8f8-0000-4000-8000-00000000000a', now()),
  ('vehicle-photos', 'f8f8f8f8-0000-4000-8000-00000000000a/f9f9f9f9-0000-4000-8000-000000000001/ok.jpg',
   'f8f8f8f8-0000-4000-8000-00000000000a', now() - interval '3 days');
insert into public.vehicle_photos (vehicle_id, storage_path)
values ('f9f9f9f9-0000-4000-8000-000000000001',
        'f8f8f8f8-0000-4000-8000-00000000000a/f9f9f9f9-0000-4000-8000-000000000001/ok.jpg');

select ok(
  exists (select 1 from private.orphan_storage_objects() where name like '%/velho.jpg'),
  'arquivo antigo sem linha é listado'
);
select ok(
  not exists (select 1 from private.orphan_storage_objects() where name like '%/novo.jpg'),
  'upload recente não é listado'
);
select ok(
  not exists (select 1 from private.orphan_storage_objects() where name like '%/ok.jpg'),
  'arquivo com linha não é listado'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"f8f8f8f8-0000-4000-8000-00000000000a","role":"authenticated"}';
select throws_ok($$ select * from private.orphan_storage_objects() $$, '42501', null, 'clientes não acessam a listagem');
reset role;

select * from finish();
rollback;
