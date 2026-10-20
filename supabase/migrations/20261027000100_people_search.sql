-- Busca de pessoas por username ou nome de exibição.
-- security invoker: a RLS de profiles continua valendo (bloqueios somem do resultado).
-- Limites no servidor contra raspagem: termo de 3 a 30 caracteres e no máximo 20 resultados.

create extension if not exists pg_trgm with schema extensions;

create index profiles_username_trgm_idx
  on public.profiles using gin (username extensions.gin_trgm_ops);
create index profiles_display_name_trgm_idx
  on public.profiles using gin (lower(display_name) extensions.gin_trgm_ops);

create function public.search_profiles(p_query text)
returns table (id uuid, username text, display_name text, city text, state text)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_term text := lower(btrim(coalesce(p_query, '')));
  v_pattern text;
begin
  if char_length(v_term) < 3 or char_length(v_term) > 30 then
    raise exception 'Digite de 3 a 30 caracteres para buscar.' using errcode = 'GH001';
  end if;
  -- Curingas digitados pelo usuário viram texto literal.
  v_pattern := '%' || replace(replace(replace(v_term, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
    select p.id, p.username, p.display_name, p.city, p.state::text
    from public.profiles p
    where p.username is not null
      and p.id <> (select auth.uid())
      and (p.username like v_pattern or lower(p.display_name) like v_pattern)
    order by (p.username = v_term) desc, (p.username like v_term || '%') desc, p.username
    limit 20;
end;
$$;

revoke all on function public.search_profiles(text) from public, anon;
grant execute on function public.search_profiles(text) to authenticated;
