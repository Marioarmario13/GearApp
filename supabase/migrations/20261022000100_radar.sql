-- Etapa 5: radar — localização de parceiros (PostGIS) e busca por raio.
--
-- Regras:
--  * Localização do parceiro é definida pelo dono via set_business_location()
--    (pin manual no mapa; sem geocodificação externa) e restrita ao território
--    brasileiro (caixa aproximada). Mudanças ficam auditadas.
--  * Busca por raio só retorna parceiros aprovados, com raio e quantidade limitados
--    no servidor e consulta indexada (GiST + ST_DWithin).
--  * A posição de quem busca é só parâmetro da consulta: não é gravada.

create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------------------
-- Coluna de localização + lat/lng derivadas (legíveis pela API)
-- ---------------------------------------------------------------------------
alter table public.businesses
  add column location extensions.geography(Point, 4326),
  add column latitude double precision
    generated always as (extensions.st_y(location::extensions.geometry)) stored,
  add column longitude double precision
    generated always as (extensions.st_x(location::extensions.geometry)) stored;

-- Caixa aproximada do Brasil (inclui ilhas oceânicas).
alter table public.businesses
  add constraint businesses_location_brazil check (
    location is null or (
      extensions.st_x(location::extensions.geometry) between -74.5 and -28.0
      and extensions.st_y(location::extensions.geometry) between -34.5 and 6.0
    )
  );

create index businesses_location_gist on public.businesses
  using gist (location) where status = 'approved';

grant select (latitude, longitude) on table public.businesses to anon, authenticated;
-- `location` em si não tem grant: escrita só pela RPC abaixo; leitura via latitude/longitude.

-- ---------------------------------------------------------------------------
-- Definir/remover localização (dono)
-- ---------------------------------------------------------------------------
create function public.set_business_location(
  p_business_id uuid,
  p_latitude double precision default null,
  p_longitude double precision default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_location extensions.geography;
begin
  if not private.owns_business(p_business_id) then
    raise exception 'Estabelecimento não encontrado' using errcode = 'P0002';
  end if;

  if (p_latitude is null) <> (p_longitude is null) then
    raise exception 'Informe latitude e longitude' using errcode = 'GH001';
  end if;

  if p_latitude is not null then
    if p_latitude not between -34.5 and 6.0 or p_longitude not between -74.5 and -28.0 then
      raise exception 'A localização precisa estar no Brasil' using errcode = 'GH001';
    end if;
    -- ~1 m de precisão é suficiente para um estabelecimento.
    v_location := extensions.st_setsrid(
      extensions.st_makepoint(round(p_longitude::numeric, 5)::float8, round(p_latitude::numeric, 5)::float8),
      4326
    )::extensions.geography;
  end if;

  update public.businesses set location = v_location where id = p_business_id;

  perform private.audit('business.location_changed', 'business', p_business_id,
    jsonb_build_object('has_location', v_location is not null));
end;
$$;

revoke all on function public.set_business_location(uuid, double precision, double precision)
  from public, anon;
grant execute on function public.set_business_location(uuid, double precision, double precision)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Busca por raio (pública)
-- ---------------------------------------------------------------------------
create function public.search_nearby_businesses(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_km double precision default 10,
  p_kind public.business_kind default null,
  p_specialty text default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  name text,
  kind public.business_kind,
  city text,
  state char(2),
  latitude double precision,
  longitude double precision,
  distance_m double precision,
  specialty_ids text[]
)
language plpgsql
stable
-- security definer: precisa ler `location` (sem grant para clientes). Por isso o filtro
-- status = 'approved' abaixo é obrigatório e só colunas públicas são devolvidas.
security definer
set search_path = ''
as $$
declare
  v_origin extensions.geography;
begin
  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'Coordenadas inválidas' using errcode = 'GH001';
  end if;
  if p_radius_km is null or p_radius_km <= 0 or p_radius_km > 100 then
    raise exception 'O raio deve estar entre 1 e 100 km' using errcode = 'GH001';
  end if;

  v_origin := extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography;

  return query
    select b.id, b.name, b.kind, b.city, b.state, b.latitude, b.longitude,
           round(extensions.st_distance(b.location, v_origin)::numeric, 0)::float8 as distance_m,
           coalesce(
             (select array_agg(s.specialty_id order by s.specialty_id)
              from public.business_specialties s where s.business_id = b.id),
             '{}'::text[]
           ) as specialty_ids
    from public.businesses b
    where b.status = 'approved'
      and b.location is not null
      and extensions.st_dwithin(b.location, v_origin, p_radius_km * 1000)
      and (p_kind is null or b.kind = p_kind)
      and (p_specialty is null or exists (
        select 1 from public.business_specialties s
        where s.business_id = b.id and s.specialty_id = p_specialty))
    order by extensions.st_distance(b.location, v_origin), b.name
    limit least(greatest(coalesce(p_limit, 50), 1), 50);
end;
$$;

revoke all on function public.search_nearby_businesses(
  double precision, double precision, double precision, public.business_kind, text, integer
) from public;
grant execute on function public.search_nearby_businesses(
  double precision, double precision, double precision, public.business_kind, text, integer
) to anon, authenticated;
