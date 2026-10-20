-- Testes de parceiros: businesses, especialidades, credenciais, aprovação admin,
-- auditoria e políticas do bucket business-documents.
-- Executar: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(57);

-- ---------------------------------------------------------------------------
-- Fixtures: O = dono, X = outro usuário, A = admin
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('dddddddd-0000-4000-8000-00000000000a', 'dono-parceiro@teste.test'),
  ('dddddddd-0000-4000-8000-00000000000b', 'outro-parceiro@teste.test'),
  ('dddddddd-0000-4000-8000-00000000000c', 'admin-parceiro@teste.test');
update public.profiles set role = 'admin' where id = 'dddddddd-0000-4000-8000-00000000000c';

create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Estrutura
-- ---------------------------------------------------------------------------
select ok(
  (select bool_and(relrowsecurity) from pg_class where oid in (
    'public.businesses'::regclass, 'public.business_specialties'::regclass,
    'public.credentials'::regclass, 'public.specialties'::regclass, 'public.audit_logs'::regclass)),
  'RLS habilitada nas tabelas de parceiros'
);
select is(
  (select public::text || '|' || file_size_limit::text from storage.buckets where id = 'business-documents'),
  'false|10485760', 'bucket business-documents é privado e limitado a 10 MB'
);
select ok((select count(*) >= 18 from public.specialties), 'catálogo de especialidades carregado');

-- ---------------------------------------------------------------------------
-- Dono (O): cadastro sempre pendente, sem controle sobre status/revisão
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"dddddddd-0000-4000-8000-00000000000a","role":"authenticated"}';

select lives_ok(
  $$ with r as (
       insert into public.businesses (kind, name, city, state, phone, phone_is_whatsapp)
       values ('workshop', 'Oficina do Teste', 'Recife', 'PE', '81999990000', true)
       returning id)
     insert into ids select 'b1', id from r $$,
  'dono cadastra parceiro'
);
select is(
  (select status::text || '|' || owner_id::text from public.businesses
   where id = (select id from ids where name = 'b1')),
  'pending|dddddddd-0000-4000-8000-00000000000a', 'parceiro nasce pendente e pertence ao dono'
);
select throws_ok(
  $$ insert into public.businesses (kind, name, city, state, status)
     values ('workshop', 'Furão', 'Recife', 'PE', 'approved') $$,
  '42501', null, 'dono não cria parceiro já aprovado'
);
select throws_ok(
  $$ update public.businesses set status = 'approved' where id = (select id from ids where name = 'b1') $$,
  '42501', null, 'dono não altera o status'
);
select throws_ok(
  $$ update public.businesses set reviewed_at = now() where id = (select id from ids where name = 'b1') $$,
  '42501', null, 'dono não altera dados de revisão'
);
select throws_ok(
  $$ select review_note from public.businesses $$,
  '42501', null, 'nota de revisão não é legível diretamente'
);
select throws_ok(
  $$ insert into public.businesses (kind, name, city, state, phone) values ('workshop', 'X', 'Recife', 'PE', '123') $$,
  '23514', null, 'constraints validam nome e telefone'
);

select lives_ok(
  $$ insert into public.business_specialties (business_id, specialty_id)
     select id, 'injecao-eletronica' from ids where name = 'b1' $$,
  'dono adiciona especialidade'
);
select throws_ok(
  $$ insert into public.business_specialties (business_id, specialty_id)
     select id, 'nao-existe' from ids where name = 'b1' $$,
  '23503', null, 'especialidade precisa existir no catálogo'
);

select lives_ok(
  $$ with r as (
       insert into public.credentials (business_id, type, title, document_path)
       select id, 'business_registration', 'Comprovante CNPJ',
              'dddddddd-0000-4000-8000-00000000000a/' || id || '/cnpj.pdf'
       from ids where name = 'b1'
       returning id)
     insert into ids select 'c_reg', id from r;
     with r as (
       insert into public.credentials (business_id, type, title, issuer, document_path)
       select id, 'certification', 'Curso de injeção', 'Escola X',
              'dddddddd-0000-4000-8000-00000000000a/' || id || '/curso.pdf'
       from ids where name = 'b1'
       returning id)
     insert into ids select 'c_cert', id from r $$,
  'dono envia documento de registro e certificação'
);
select is(
  (select string_agg(distinct status::text, ',') from public.credentials
   where business_id = (select id from ids where name = 'b1')),
  'pending', 'credenciais nascem pendentes'
);
select throws_ok(
  $$ insert into public.credentials (business_id, type, title, document_path)
     select id, 'certification', 'Fora da pasta',
            'dddddddd-0000-4000-8000-00000000000b/' || id || '/x.pdf'
     from ids where name = 'b1' $$,
  '23514', null, 'documento fora da pasta do parceiro é rejeitado'
);
select throws_ok(
  $$ insert into public.credentials (business_id, type, title, document_path, status)
     select id, 'certification', 'Aprovada?', 'dddddddd-0000-4000-8000-00000000000a/' || id || '/y.pdf', 'approved'
     from ids where name = 'b1' $$,
  '42501', null, 'dono não cria credencial já aprovada'
);
select throws_ok(
  $$ update public.credentials set status = 'approved' where id = (select id from ids where name = 'c_reg') $$,
  '42501', null, 'dono não aprova a própria credencial'
);
select throws_ok(
  $$ select public.review_business((select id from ids where name = 'b1'), 'approved', null) $$,
  '42501', null, 'dono não aprova o próprio parceiro'
);
select throws_ok(
  $$ select public.review_credential((select id from ids where name = 'c_reg'), 'approved', null) $$,
  '42501', null, 'dono não revisa credenciais'
);
select is(
  (select status::text from public.get_business_review((select id from ids where name = 'b1'))),
  'pending', 'dono consulta a situação da revisão'
);
select is(
  (select count(*)::int from public.get_business_credentials((select id from ids where name = 'b1'))
   where document_path is not null),
  2, 'dono vê os caminhos dos próprios documentos'
);

-- Storage
select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     select 'business-documents', 'dddddddd-0000-4000-8000-00000000000a/' || id || '/cnpj.pdf'
     from ids where name = 'b1' $$,
  'dono envia arquivo para a pasta do parceiro'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     select 'business-documents', 'dddddddd-0000-4000-8000-00000000000b/' || id || '/x.pdf'
     from ids where name = 'b1' $$,
  '42501', null, 'dono não envia arquivo para pasta de outro usuário'
);

-- Limite: 3 parceiros por usuário
select lives_ok(
  $$ insert into public.businesses (kind, name, city, state) values
     ('tuner', 'Segundo', 'Recife', 'PE'), ('tuner', 'Terceiro', 'Recife', 'PE') $$,
  'dono cadastra até 3 parceiros'
);
select throws_ok(
  $$ insert into public.businesses (kind, name, city, state) values ('tuner', 'Quarto', 'Recife', 'PE') $$,
  'GH001', null, 'o 4º parceiro é rejeitado'
);
reset role;

-- ---------------------------------------------------------------------------
-- Outro usuário (X) e anônimo: nada pendente é visível
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"dddddddd-0000-4000-8000-00000000000b","role":"authenticated"}';

select is_empty(
  $$ select id from public.businesses where owner_id = 'dddddddd-0000-4000-8000-00000000000a' $$,
  'outro usuário não vê parceiro pendente'
);
select is_empty(
  $$ select id from public.credentials where business_id = (select id from ids where name = 'b1') $$,
  'outro usuário não vê credenciais pendentes'
);
select is_empty(
  $$ select * from public.get_business_credentials((select id from ids where name = 'b1')) $$,
  'outro usuário não obtém caminhos de documentos'
);
select is_empty(
  $$ select * from public.get_business_review((select id from ids where name = 'b1')) $$,
  'outro usuário não vê a revisão'
);
select is_empty(
  $$ select name from storage.objects where bucket_id = 'business-documents' $$,
  'outro usuário não lê documentos no Storage'
);
select throws_ok(
  $$ insert into public.credentials (business_id, type, title, document_path)
     select id, 'certification', 'Intruso', 'dddddddd-0000-4000-8000-00000000000b/' || id || '/i.pdf'
     from ids where name = 'b1' $$,
  '42501', null, 'outro usuário não envia credencial para parceiro alheio'
);
select is_empty($$ select id from public.audit_logs $$, 'usuário comum não lê a auditoria');
reset role;

set local role anon;
select ok((select count(*) >= 18 from public.specialties), 'anônimo lê especialidades');
select is_empty(
  $$ select id from public.businesses where id = (select id from ids where name = 'b1') $$,
  'anônimo não vê parceiro pendente'
);
select throws_ok(
  $$ insert into public.businesses (kind, name, city, state) values ('workshop', 'Anon', 'Recife', 'PE') $$,
  '42501', null, 'anônimo não cadastra parceiro'
);
select throws_ok($$ select id from public.audit_logs $$, '42501', null, 'anônimo não lê a auditoria');
reset role;

-- ---------------------------------------------------------------------------
-- Admin (A): conferência documentada antes da aprovação
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"dddddddd-0000-4000-8000-00000000000c","role":"authenticated"}';

select is(
  (select status::text from public.businesses where id = (select id from ids where name = 'b1')),
  'pending', 'admin vê parceiro pendente na fila'
);
select is(
  (select count(*)::int from public.get_business_credentials((select id from ids where name = 'b1'))),
  2, 'admin vê os documentos enviados'
);
select is(
  (select count(*)::int from storage.objects where bucket_id = 'business-documents'
   and name like 'dddddddd-0000-4000-8000-00000000000a/%'),
  1, 'admin lê o arquivo do documento no Storage'
);
select throws_ok(
  $$ select public.review_business((select id from ids where name = 'b1'), 'approved', null) $$,
  'GH001', null, 'aprovar sem documento de registro conferido é bloqueado'
);
select throws_ok(
  $$ select public.review_credential((select id from ids where name = 'c_reg'), 'rejected', '') $$,
  'GH001', null, 'recusa exige motivo'
);
select lives_ok(
  $$ select public.review_credential((select id from ids where name = 'c_reg'), 'approved', null) $$,
  'admin aprova o documento de registro'
);
select lives_ok(
  $$ select public.review_business((select id from ids where name = 'b1'), 'approved', 'Documentos ok') $$,
  'admin aprova o parceiro'
);
select is(
  (select count(*)::int from public.audit_logs
   where entity_id in ((select id from ids where name = 'b1'), (select id from ids where name = 'c_reg'))),
  2, 'aprovações registradas na auditoria'
);
select is(
  (select actor_id::text from public.audit_logs where action = 'business.approved'
   and entity_id = (select id from ids where name = 'b1')),
  'dddddddd-0000-4000-8000-00000000000c', 'auditoria registra quem aprovou'
);
reset role;

-- ---------------------------------------------------------------------------
-- Público após aprovação: só o que foi conferido
-- ---------------------------------------------------------------------------
set local role anon;
select is(
  (select status::text from public.businesses where id = (select id from ids where name = 'b1')),
  'approved', 'anônimo vê o parceiro aprovado'
);
select results_eq(
  $$ select title from public.credentials where business_id = (select id from ids where name = 'b1') $$,
  $$ values ('Comprovante CNPJ') $$,
  'anônimo vê só a credencial aprovada (certificação pendente fica oculta)'
);
select throws_ok(
  $$ select document_path from public.credentials $$,
  '42501', null, 'caminho do documento nunca é público'
);
select is(
  (select count(*)::int from public.business_specialties
   where business_id = (select id from ids where name = 'b1')),
  1, 'anônimo vê as especialidades do parceiro aprovado'
);
reset role;

-- ---------------------------------------------------------------------------
-- Mudança de identidade volta para conferência
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"dddddddd-0000-4000-8000-00000000000a","role":"authenticated"}';
select lives_ok(
  $$ update public.businesses set phone = '81988887777' where id = (select id from ids where name = 'b1') $$,
  'dono altera telefone'
);
select is(
  (select status::text from public.businesses where id = (select id from ids where name = 'b1')),
  'approved', 'alterar contato mantém a aprovação'
);
select lives_ok(
  $$ update public.businesses set name = 'Outro Nome' where id = (select id from ids where name = 'b1') $$,
  'dono altera o nome'
);
select is(
  (select status::text from public.businesses where id = (select id from ids where name = 'b1')),
  'pending', 'alterar o nome devolve o parceiro para conferência'
);
reset role;

select ok(
  exists (select 1 from public.audit_logs where action = 'business.resubmitted'
          and entity_id = (select id from ids where name = 'b1')),
  'mudança de identidade é auditada'
);

-- Recusar o registro de um parceiro aprovado devolve-o para conferência.
set local role authenticated;
set local request.jwt.claims = '{"sub":"dddddddd-0000-4000-8000-00000000000c","role":"authenticated"}';
select lives_ok(
  $$ select public.review_business((select id from ids where name = 'b1'), 'approved', null);
     select public.review_credential((select id from ids where name = 'c_reg'), 'rejected', 'Documento ilegível') $$,
  'admin reaprova e depois recusa o registro'
);
reset role;
select is(
  (select status::text from public.businesses where id = (select id from ids where name = 'b1')),
  'pending', 'sem registro conferido, o parceiro sai do diretório'
);

-- Suspensão exige motivo.
set local role authenticated;
set local request.jwt.claims = '{"sub":"dddddddd-0000-4000-8000-00000000000c","role":"authenticated"}';
select throws_ok(
  $$ select public.review_business((select id from ids where name = 'b1'), 'suspended', null) $$,
  'GH001', null, 'suspensão exige motivo'
);
reset role;

select * from finish();
rollback;
