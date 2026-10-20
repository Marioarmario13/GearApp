-- Testes de profiles: trigger de criação, RLS, grants por coluna e escalonamento de privilégio.
-- Executar: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(26);

-- ---------------------------------------------------------------------------
-- Fixtures (ids fictícios, independentes do seed)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'ana@teste.test',   '{"username":"Ana_Teste","display_name":"Ana"}'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'bruno@teste.test', '{"username":"bruno_teste","display_name":"Bruno"}'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'caio@teste.test',  '{"username":"x!"}'),
  ('aaaaaaaa-0000-4000-8000-000000000004', 'dani@teste.test',  '{"username":"bruno_teste"}'),
  ('aaaaaaaa-0000-4000-8000-000000000005', 'root@teste.test',  '{"username":"root_teste"}');

update public.profiles set role = 'admin' where id = 'aaaaaaaa-0000-4000-8000-000000000005';

-- ---------------------------------------------------------------------------
-- Estrutura
-- ---------------------------------------------------------------------------
select has_table('public', 'profiles', 'tabela profiles existe');
select is(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  true, 'RLS habilitada em profiles'
);

-- ---------------------------------------------------------------------------
-- Trigger de criação
-- ---------------------------------------------------------------------------
select is(
  (select username from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'ana_teste', 'username do cadastro é normalizado para minúsculas'
);
select is(
  (select username from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000003'),
  null, 'username inválido vira NULL sem bloquear o cadastro'
);
select ok(
  exists (select 1 from public.profiles
          where id = 'aaaaaaaa-0000-4000-8000-000000000004' and username is null),
  'username duplicado vira NULL e o perfil é criado mesmo assim'
);
select is(
  (select role::text from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000002'),
  'user', 'papel padrão é user'
);

-- ---------------------------------------------------------------------------
-- Anônimo
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok(
  $$ select id from public.profiles $$, '42501', null, 'anon não lê profiles'
);
select throws_ok(
  $$ select public.set_user_role('aaaaaaaa-0000-4000-8000-000000000001', 'admin') $$,
  '42501', null, 'anon não executa set_user_role'
);
select throws_ok(
  $$ select public.current_user_role() $$, '42501', null, 'anon não executa current_user_role'
);
reset role;

-- ---------------------------------------------------------------------------
-- Usuário comum (Ana)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select is(
  (select username from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000002'),
  'bruno_teste', 'autenticado lê colunas públicas de outro perfil'
);
select throws_ok(
  $$ select role from public.profiles $$, '42501', null, 'autenticado não lê a coluna role'
);
select is(public.current_user_role()::text, 'user', 'current_user_role retorna o próprio papel');

select lives_ok(
  $$ update public.profiles set display_name = 'Ana Atualizada', city = 'Recife', state = 'PE'
     where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'usuário edita o próprio perfil'
);
select lives_ok(
  $$ update public.profiles set display_name = 'Hackeado'
     where id = 'aaaaaaaa-0000-4000-8000-000000000002' $$,
  'update em perfil alheio não gera erro (RLS filtra a linha)...'
);
select throws_ok(
  $$ update public.profiles set role = 'admin' where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  '42501', null, 'usuário não altera o próprio role'
);
select throws_ok(
  $$ update public.profiles set id = 'aaaaaaaa-0000-4000-8000-000000000009'
     where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  '42501', null, 'usuário não altera o id (proprietário)'
);
select throws_ok(
  $$ insert into public.profiles (id) values ('aaaaaaaa-0000-4000-8000-000000000009') $$,
  '42501', null, 'usuário não insere perfis'
);
select throws_ok(
  $$ delete from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  '42501', null, 'usuário não exclui perfis'
);
select throws_ok(
  $$ select public.set_user_role('aaaaaaaa-0000-4000-8000-000000000001', 'admin') $$,
  '42501', null, 'usuário comum não se promove a admin'
);
select throws_ok(
  $$ update public.profiles set username = 'Nome Inválido'
     where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  '23514', null, 'constraint rejeita username fora do formato'
);
select throws_ok(
  $$ update public.profiles set state = 'XX' where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  '23514', null, 'constraint rejeita UF inválida'
);
reset role;

select is(
  (select display_name from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000002'),
  'Bruno', '...e o perfil alheio permanece inalterado'
);
select is(
  (select display_name || '|' || city || '|' || state
   from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'Ana Atualizada|Recife|PE', 'edição do próprio perfil foi persistida'
);

-- ---------------------------------------------------------------------------
-- Administrador
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000005","role":"authenticated"}';

select lives_ok(
  $$ select public.set_user_role('aaaaaaaa-0000-4000-8000-000000000002', 'admin') $$,
  'admin altera papel de outro usuário'
);
select throws_ok(
  $$ select public.set_user_role('aaaaaaaa-0000-4000-8000-00000000ffff', 'admin') $$,
  'P0002', null, 'set_user_role falha para usuário inexistente'
);
reset role;

select is(
  (select role::text from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000002'),
  'admin', 'papel alterado pelo admin foi persistido'
);

select * from finish();
rollback;
