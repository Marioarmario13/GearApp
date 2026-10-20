-- Testes de eventos (presença) e benefícios (ofertas e cupons).
-- Executar: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(47);

-- ---------------------------------------------------------------------------
-- Fixtures: O = organizador/dono de parceiro, U = usuário, V = outro usuário, A = admin
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('a1a1a1a1-0000-4000-8000-00000000000a', 'org@teste.test'),
  ('a1a1a1a1-0000-4000-8000-00000000000b', 'user@teste.test'),
  ('a1a1a1a1-0000-4000-8000-00000000000c', 'outro@teste.test'),
  ('a1a1a1a1-0000-4000-8000-00000000000d', 'adm@teste.test');
update public.profiles set role = 'admin' where id = 'a1a1a1a1-0000-4000-8000-00000000000d';

insert into public.businesses (id, owner_id, kind, name, city, state) values
  ('b2b2b2b2-0000-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-00000000000a', 'workshop', 'Oficina Org', 'Recife', 'PE'),
  ('b2b2b2b2-0000-4000-8000-000000000002', 'a1a1a1a1-0000-4000-8000-00000000000a', 'workshop', 'Oficina Pendente', 'Recife', 'PE');
update public.businesses set status = 'approved' where id = 'b2b2b2b2-0000-4000-8000-000000000001';

create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Eventos: criação e validações
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1a1a1a1-0000-4000-8000-00000000000a","role":"authenticated"}';

select lives_ok(
  $$ with r as (
       insert into public.events (kind, title, starts_at, ends_at, venue_name, city, state, capacity, business_id)
       values ('meetup', 'Encontro teste', now() + interval '2 days', now() + interval '2 days 4 hours',
               'Praça X', 'Recife', 'PE', 2, 'b2b2b2b2-0000-4000-8000-000000000001')
       returning id)
     insert into ids select 'ev', id from r $$,
  'organizador cria evento futuro com parceiro verificado como anfitrião'
);
select is(
  (select status::text || '|' || attendee_count from public.events where id = (select id from ids where name = 'ev')),
  'scheduled|0', 'evento nasce agendado e sem confirmados'
);
select throws_ok(
  $$ insert into public.events (kind, title, starts_at, ends_at, venue_name, city, state)
     values ('meetup', 'Passado', now() - interval '1 day', now() - interval '20 hours', 'X', 'Recife', 'PE') $$,
  'GH001', null, 'evento no passado é rejeitado'
);
select throws_ok(
  $$ insert into public.events (kind, title, starts_at, ends_at, venue_name, city, state)
     values ('meetup', 'Longo', now() + interval '1 day', now() + interval '9 days', 'X', 'Recife', 'PE') $$,
  '23514', null, 'evento com mais de 7 dias é rejeitado'
);
select throws_ok(
  $$ insert into public.events (kind, title, starts_at, ends_at, venue_name, city, state)
     values ('meetup', 'Invertido', now() + interval '2 days', now() + interval '1 day', 'X', 'Recife', 'PE') $$,
  '23514', null, 'fim antes do início é rejeitado'
);
select throws_ok(
  $$ insert into public.events (kind, title, starts_at, ends_at, venue_name, city, state, business_id)
     values ('meetup', 'Anfitrião pendente', now() + interval '1 day', now() + interval '1 day 2 hours',
             'X', 'Recife', 'PE', 'b2b2b2b2-0000-4000-8000-000000000002') $$,
  'GH001', null, 'parceiro não verificado não pode ser anfitrião'
);
select throws_ok(
  $$ insert into public.events (kind, title, starts_at, ends_at, venue_name, city, state, status)
     values ('meetup', 'Status', now() + interval '1 day', now() + interval '1 day 2 hours', 'X', 'Recife', 'PE', 'cancelled') $$,
  '42501', null, 'organizador não define status diretamente'
);
select throws_ok(
  $$ update public.events set attendee_count = 99 where id = (select id from ids where name = 'ev') $$,
  '42501', null, 'contador de confirmados não é editável'
);
select lives_ok(
  $$ select public.set_event_location((select id from ids where name = 'ev'), -8.05, -34.9) $$,
  'organizador posiciona o evento no mapa'
);
reset role;

-- Outro usuário não altera o evento.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1a1a1a1-0000-4000-8000-00000000000c","role":"authenticated"}';
select lives_ok(
  $$ update public.events set title = 'Hackeado' where id = (select id from ids where name = 'ev') $$,
  'update em evento alheio não gera erro (RLS filtra)...'
);
select throws_ok(
  $$ select public.cancel_event((select id from ids where name = 'ev'), 'x') $$,
  'P0002', null, 'outro usuário não cancela o evento'
);
select throws_ok(
  $$ select public.set_event_location((select id from ids where name = 'ev'), -8.0, -34.9) $$,
  'P0002', null, 'outro usuário não move o evento'
);
reset role;
select is(
  (select title from public.events where id = (select id from ids where name = 'ev')),
  'Encontro teste', '...e o evento permanece inalterado'
);

-- ---------------------------------------------------------------------------
-- Presença
-- ---------------------------------------------------------------------------
set local role anon;
select is(
  (select attendee_count from public.events where id = (select id from ids where name = 'ev')),
  0, 'anônimo vê o evento e o total de confirmados'
);
select throws_ok(
  $$ select public.rsvp_event((select id from ids where name = 'ev')) $$,
  '42501', null, 'anônimo não confirma presença'
);
select throws_ok($$ select user_id from public.event_attendees $$, '42501', null, 'anônimo não lê a lista de presença');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1a1a1a1-0000-4000-8000-00000000000b","role":"authenticated"}';
select is(public.rsvp_event((select id from ids where name = 'ev')), 1, 'usuário confirma presença');
select is(public.rsvp_event((select id from ids where name = 'ev')), 1, 'confirmar de novo é idempotente');
select throws_ok(
  $$ insert into public.event_attendees (event_id, user_id) select id, 'a1a1a1a1-0000-4000-8000-00000000000c' from ids where name = 'ev' $$,
  '42501', null, 'presença não é inserida diretamente (só pela RPC)'
);
select is_empty(
  $$ select * from public.get_event_attendees((select id from ids where name = 'ev')) $$,
  'participante não vê a lista completa de confirmados'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1a1a1a1-0000-4000-8000-00000000000c","role":"authenticated"}';
select is(public.rsvp_event((select id from ids where name = 'ev')), 2, 'segundo usuário confirma (lotação 2)');
select is_empty(
  $$ select user_id from public.event_attendees where user_id = 'a1a1a1a1-0000-4000-8000-00000000000b' $$,
  'usuário não vê a presença de outra pessoa'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1a1a1a1-0000-4000-8000-00000000000d","role":"authenticated"}';
select throws_ok(
  $$ select public.rsvp_event((select id from ids where name = 'ev')) $$,
  'GH001', null, 'evento lotado recusa nova confirmação'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1a1a1a1-0000-4000-8000-00000000000a","role":"authenticated"}';
select is(
  (select count(*)::int from public.get_event_attendees((select id from ids where name = 'ev'))),
  2, 'organizador vê a lista de confirmados'
);
select throws_ok(
  $$ update public.events set capacity = 1 where id = (select id from ids where name = 'ev') $$,
  'GH001', null, 'capacidade não pode ficar abaixo dos confirmados'
);
reset role;

-- Desistência libera vaga.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1a1a1a1-0000-4000-8000-00000000000b","role":"authenticated"}';
select lives_ok(
  $$ delete from public.event_attendees where event_id = (select id from ids where name = 'ev') and user_id = 'a1a1a1a1-0000-4000-8000-00000000000b' $$,
  'usuário desiste da presença'
);
reset role;
select is(
  (select attendee_count from public.events where id = (select id from ids where name = 'ev')),
  1, 'total de confirmados é atualizado'
);

-- Cancelamento pelo organizador e remoção por admin.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1a1a1a1-0000-4000-8000-00000000000a","role":"authenticated"}';
select lives_ok(
  $$ select public.cancel_event((select id from ids where name = 'ev'), 'Chuva forte') $$,
  'organizador cancela o evento'
);
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1a1a1a1-0000-4000-8000-00000000000b","role":"authenticated"}';
select throws_ok(
  $$ select public.rsvp_event((select id from ids where name = 'ev')) $$,
  'GH001', null, 'evento cancelado não aceita confirmação'
);
select throws_ok(
  $$ select public.remove_event((select id from ids where name = 'ev'), 'spam spam') $$,
  '42501', null, 'usuário comum não remove eventos'
);
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1a1a1a1-0000-4000-8000-00000000000d","role":"authenticated"}';
select lives_ok(
  $$ select public.remove_event((select id from ids where name = 'ev'), 'Conteúdo impróprio') $$,
  'admin remove evento com motivo'
);
reset role;
set local role anon;
select is_empty(
  $$ select id from public.events where id = (select id from ids where name = 'ev') $$,
  'evento removido some para o público'
);
reset role;
select ok(
  exists (select 1 from public.audit_logs where action = 'event.removed' and entity_id = (select id from ids where name = 'ev')),
  'remoção de evento é auditada'
);

-- ---------------------------------------------------------------------------
-- Ofertas e cupons
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1a1a1a1-0000-4000-8000-00000000000a","role":"authenticated"}';
select lives_ok(
  $$ with r as (
       insert into public.offers (business_id, title, discount_label, ends_at, max_redemptions, per_user_limit)
       values ('b2b2b2b2-0000-4000-8000-000000000001', 'Troca de óleo', '10% OFF', now() + interval '30 days', 2, 1)
       returning id)
     insert into ids select 'of', id from r;
     with r as (
       insert into public.offers (business_id, title, discount_label, ends_at)
       values ('b2b2b2b2-0000-4000-8000-000000000002', 'Oferta de pendente', '5% OFF', now() + interval '30 days')
       returning id)
     insert into ids select 'of_pend', id from r $$,
  'dono cria ofertas'
);
select throws_ok(
  $$ insert into public.offers (business_id, title, discount_label, ends_at)
     values ('b2b2b2b2-0000-4000-8000-000000000001', 'Vencida', '5%', now() - interval '1 day') $$,
  'GH001', null, 'oferta já vencida é rejeitada'
);
select throws_ok(
  $$ select public.claim_offer((select id from ids where name = 'of')) $$,
  'GH001', null, 'dono não pega cupom da própria oferta'
);
reset role;

set local role anon;
select results_eq(
  $$ select title from public.offers where business_id in ('b2b2b2b2-0000-4000-8000-000000000001', 'b2b2b2b2-0000-4000-8000-000000000002') $$,
  $$ values ('Troca de óleo') $$,
  'público vê só ofertas de parceiros aprovados'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1a1a1a1-0000-4000-8000-00000000000c","role":"authenticated"}';
select throws_ok(
  $$ insert into public.offers (business_id, title, discount_label, ends_at)
     values ('b2b2b2b2-0000-4000-8000-000000000001', 'Intruso', '99%', now() + interval '1 day') $$,
  '42501', null, 'usuário não cria oferta para parceiro alheio'
);
select lives_ok(
  $$ select * from public.claim_offer((select id from ids where name = 'of')) $$,
  'usuário pega um cupom'
);
reset role;
select matches(
  (select code from public.coupons where offer_id = (select id from ids where name = 'of') limit 1),
  '^[A-HJ-KM-NP-Z2-9]{8}$', 'código de cupom no formato esperado'
);
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1a1a1a1-0000-4000-8000-00000000000c","role":"authenticated"}';
select throws_ok(
  $$ select * from public.claim_offer((select id from ids where name = 'of')) $$,
  'GH001', null, 'limite por usuário é respeitado'
);
select throws_ok(
  $$ select * from public.claim_offer((select id from ids where name = 'of_pend')) $$,
  'P0002', null, 'oferta de parceiro não aprovado não emite cupom'
);
reset role;

-- Limite total (2): U pega o segundo; admin não consegue o terceiro.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1a1a1a1-0000-4000-8000-00000000000b","role":"authenticated"}';
select lives_ok(
  $$ select * from public.claim_offer((select id from ids where name = 'of')) $$, 'segundo cupom emitido'
);
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1a1a1a1-0000-4000-8000-00000000000d","role":"authenticated"}';
select throws_ok(
  $$ select * from public.claim_offer((select id from ids where name = 'of')) $$,
  'GH001', null, 'limite total de cupons é respeitado'
);
reset role;

-- Resgate no balcão.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1a1a1a1-0000-4000-8000-00000000000b","role":"authenticated"}';
select throws_ok(
  $$ select * from public.redeem_coupon((select code from public.coupons
       where user_id = 'a1a1a1a1-0000-4000-8000-00000000000b' limit 1)) $$,
  'P0002', null, 'cliente não resgata o próprio cupom (só o parceiro)'
);
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1a1a1a1-0000-4000-8000-00000000000a","role":"authenticated"}';
select is(
  (select discount_label from public.redeem_coupon(
     lower((select code from public.coupons where user_id = 'a1a1a1a1-0000-4000-8000-00000000000c' limit 1)))),
  '10% OFF', 'parceiro resgata o cupom (código normalizado)'
);
select throws_ok(
  $$ select * from public.redeem_coupon((select code from public.coupons where user_id = 'a1a1a1a1-0000-4000-8000-00000000000c' limit 1)) $$,
  'GH001', null, 'cupom já utilizado não é resgatado de novo'
);
reset role;

select * from finish();
rollback;
