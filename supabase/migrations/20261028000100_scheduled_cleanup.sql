-- Limpezas agendadas (pg_cron) e apoio à rotina de arquivos órfãos (docs/OPERATIONS.md).

create extension if not exists pg_cron;

-- Posições expiradas/revogadas e presenças vencidas: além da limpeza a cada acesso às RPCs,
-- roda a cada 10 min para não depender de alguém usar o recurso.
select cron.schedule(
  'purge-expired-locations',
  '*/10 * * * *',
  $$select private.purge_expired_locations()$$
);

-- Histórico do próprio pg_cron: mantém só 7 dias (evita crescer sem limite).
select cron.schedule(
  'purge-cron-history',
  '17 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$
);

-- Arquivos no Storage sem linha correspondente (ex.: falha ao remover depois de apagar a
-- linha, ou upload interrompido). Só lista: a remoção deve ser feita pela API do Storage
-- (SQL não apaga o arquivo físico). Ignora objetos com menos de 1 dia (upload em andamento).
-- Uso operacional no editor SQL: select * from private.orphan_storage_objects();
create function private.orphan_storage_objects()
returns table (bucket_id text, name text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select o.bucket_id, o.name, o.created_at
  from storage.objects o
  where o.created_at < now() - interval '1 day'
    and (
      (o.bucket_id = 'vehicle-photos'
        and not exists (select 1 from public.vehicle_photos p where p.storage_path = o.name))
      or (o.bucket_id = 'business-documents'
        and not exists (select 1 from public.credentials c where c.document_path = o.name))
    )
  order by o.created_at;
$$;

revoke all on function private.orphan_storage_objects() from public, anon, authenticated;
