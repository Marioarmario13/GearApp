# Implantação — Gearhead

> **Nada aqui foi executado.** Publicar exige autorização explícita do responsável, contas próprias e revisão de custos/limites nos sites oficiais (planos gratuitos mudam e podem pausar projetos inativos). Siga na ordem e marque cada passo.

## 1. Pré-requisitos

- [ ] Pendências jurídicas de [`PRIVACY.md`](./PRIVACY.md) resolvidas (termos, política, DPO).
- [ ] Checklist de [`PILOT_CHECKLIST.md`](./PILOT_CHECKLIST.md) revisado.
- [ ] CI verde no commit a publicar.

## 2. Banco (Supabase)

1. Criar projeto no painel do Supabase (região próxima ao Brasil; anotar limites do plano).
2. Vincular localmente: `npx supabase link --project-ref <ref>` (pede login do responsável).
3. Revisar o que será aplicado: `npx supabase db push --dry-run`.
4. Aplicar migrações: `npx supabase db push`. **Não rodar `seed.sql` em produção** (dados fictícios e senhas de teste).
5. Em Authentication → Settings:
   - ativar **confirmação de e-mail**;
   - URL do site e URLs de redirecionamento do domínio real (e o esquema `gearhead://` do app);
   - senha mínima 8 com letras e números (igual ao `config.toml`);
   - configurar SMTP próprio para e-mails transacionais (o envio padrão tem limites baixos).
6. Habilitar proteção contra abuso no cadastro (CAPTCHA do Supabase Auth) e revisar rate limits.
7. Agendar a limpeza de localizações (extensão `pg_cron`, pelo SQL Editor):

   ```sql
   create extension if not exists pg_cron;
   select cron.schedule('gearhead-purge-locations', '*/10 * * * *',
     $$ select private.purge_expired_locations(); $$);
   ```

8. Criar o primeiro administrador: após o cadastro normal, no SQL Editor:
   `update public.profiles set role = 'admin' where id = '<uuid do usuário>';`
9. Rodar o **Security Advisor** e o **Performance Advisor** do painel e tratar alertas.
10. Confirmar backups do plano (ver [`OPERATIONS.md`](./OPERATIONS.md)).

## 3. Site (Next.js)

1. Escolher hospedagem compatível com Next.js 16 (Server Actions, `proxy.ts`). Conferir limites de builds, funções e tráfego do plano.
2. Variáveis de ambiente (somente estas; **nunca** `service_role`):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - opcional `NEXT_PUBLIC_MAP_STYLE_URL` (ver [`MAPS.md`](./MAPS.md))
3. Comando de build: `npm run build:web` (o `prebuild` copia o worker do MapLibre).
4. Conferir após publicar: cabeçalhos de segurança (`curl -I`), login, cadastro com confirmação, `/conta/dados`, radar.

## 4. App (Expo)

1. `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` apontando para o projeto de produção.
2. Revisar `app.json`: nome, ícones, `scheme`, textos de permissão (fotos e localização em primeiro plano; **sem** localização em segundo plano).
3. Builds com EAS (`npx eas-cli@latest build`) exigem conta Expo; publicação nas lojas exige contas pagas da Apple/Google — **decisão do responsável**.
4. Se o desempenho do mapa na WebView não for suficiente, migrar para `@maplibre/maplibre-react-native` (exige development build).

## 5. Pós-publicação

- [ ] Teste de fumaça em aparelho real (Android e iOS).
- [ ] Monitorar uso/cotas no painel do Supabase e da hospedagem (ver [`OPERATIONS.md`](./OPERATIONS.md)).
