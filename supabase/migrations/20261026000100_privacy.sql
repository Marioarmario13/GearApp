-- Etapa 9: direitos do titular (LGPD) — exportação dos próprios dados e exclusão da conta.
--
--  * export_my_data(): devolve, em JSON, tudo o que a plataforma guarda sobre o usuário
--    (acesso e portabilidade). Inclui caminhos de arquivos; os arquivos são baixados à parte.
--  * delete_my_account(confirmação): apaga o usuário de auth.users; os dados pessoais saem
--    em cascata (perfil, veículos, parceiros, eventos, presenças, cupons, amizades,
--    bloqueios, denúncias feitas, localizações). Os ARQUIVOS no Storage devem ser removidos
--    pelo cliente antes (as políticas só permitem ao dono). A auditoria registra o evento
--    sem dados pessoais (o vínculo actor_id vira NULL por ON DELETE SET NULL).

create function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Entre para exportar seus dados' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'gerado_em', now(),
    'conta', (select jsonb_build_object('id', u.id, 'email', u.email, 'criada_em', u.created_at,
                                        'ultimo_acesso', u.last_sign_in_at)
              from auth.users u where u.id = v_uid),
    'perfil', (select to_jsonb(p) - 'role' from public.profiles p where p.id = v_uid),
    'veiculos', coalesce((select jsonb_agg(to_jsonb(v) || jsonb_build_object(
                   'placa', (select vp.plate from public.vehicle_private vp where vp.vehicle_id = v.id),
                   'fotos', (select coalesce(jsonb_agg(ph.storage_path), '[]') from public.vehicle_photos ph where ph.vehicle_id = v.id)))
                 from public.vehicles v where v.owner_id = v_uid), '[]'),
    'parceiros', coalesce((select jsonb_agg((to_jsonb(b) - 'location') || jsonb_build_object(
                   'documentos', (select coalesce(jsonb_agg(to_jsonb(c) - 'reviewed_by'), '[]')
                                  from public.credentials c where c.business_id = b.id)))
                 from public.businesses b where b.owner_id = v_uid), '[]'),
    'eventos_organizados', coalesce((select jsonb_agg(to_jsonb(e) - 'location')
                 from public.events e where e.organizer_id = v_uid), '[]'),
    'presencas_em_eventos', coalesce((select jsonb_agg(jsonb_build_object('evento_id', a.event_id, 'confirmado_em', a.created_at))
                 from public.event_attendees a where a.user_id = v_uid), '[]'),
    'cupons', coalesce((select jsonb_agg(to_jsonb(c)) from public.coupons c where c.user_id = v_uid), '[]'),
    'amizades', coalesce((select jsonb_agg(jsonb_build_object(
                   'com', case when f.requester_id = v_uid then f.addressee_id else f.requester_id end,
                   'status', f.status, 'desde', f.created_at))
                 from public.friendships f where v_uid in (f.requester_id, f.addressee_id)), '[]'),
    'bloqueios_feitos', coalesce((select jsonb_agg(jsonb_build_object('usuario', b.blocked_id, 'em', b.created_at))
                 from public.blocks b where b.blocker_id = v_uid), '[]'),
    'denuncias_feitas', coalesce((select jsonb_agg(to_jsonb(r) - 'resolved_by') from public.reports r where r.reporter_id = v_uid), '[]'),
    'compartilhamentos_de_localizacao', coalesce((select jsonb_agg(jsonb_build_object(
                   'id', s.id, 'finalidade', s.purpose, 'inicio', s.started_at, 'fim', s.expires_at,
                   'revogado_em', s.revoked_at, 'ultima_posicao',
                   case when s.latitude is null then null
                        else jsonb_build_object('lat', s.latitude, 'lng', s.longitude, 'em', s.position_at) end))
                 from public.location_sessions s where s.owner_id = v_uid), '[]'),
    'presenca_aproximada', (select to_jsonb(e) from public.ephemeral_presence e where e.user_id = v_uid)
  );
end;
$$;

create function public.delete_my_account(p_confirmation text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Entre para excluir sua conta' using errcode = '42501';
  end if;
  if p_confirmation is distinct from 'EXCLUIR' then
    raise exception 'Digite EXCLUIR para confirmar' using errcode = 'GH001';
  end if;
  -- Evita deixar a plataforma sem administrador por engano.
  if (select p.role from public.profiles p where p.id = v_uid) = 'admin'
     and (select count(*) from public.profiles p where p.role = 'admin') <= 1 then
    raise exception 'Você é o único administrador. Promova outra pessoa antes de excluir a conta'
      using errcode = 'GH001';
  end if;

  perform private.audit('account.deleted', 'account', v_uid, '{}'::jsonb);
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.export_my_data(), public.delete_my_account(text) from public, anon;
grant execute on function public.export_my_data(), public.delete_my_account(text) to authenticated;
