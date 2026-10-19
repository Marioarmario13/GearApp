# Gearhead

Plataforma brasileira para entusiastas automotivos: garagem virtual, diretório de profissionais verificados, radar geográfico, eventos, benefícios de parceiros e comunidade. Site responsivo + painel (Next.js) e app Android/iOS (Expo).

> Status: **Etapa 1 — fundação técnica**. Ainda não há banco nem autenticação. Veja [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Estrutura

```
apps/
  web/       Next.js (App Router) — site e futuro painel administrativo
  mobile/    Expo / React Native — app Android e iOS
packages/
  shared/    Schemas Zod, tipos e regras de domínio puras (usado por web e mobile)
docs/        Requisitos, arquitetura, modelo de dados, segurança, roadmap
```

## Pré-requisitos

- Node.js 24 (ver `.nvmrc`; mínimo 22) e npm 11+
- Para o app: [Expo Go](https://expo.dev/go) no celular, ou emulador Android/simulador iOS
- Docker (a partir da Etapa 2, para o Supabase local)

## Como rodar

```bash
npm install          # instala todos os workspaces
npm run dev:web      # site em http://localhost:3000
npm run dev:mobile   # Expo; escaneie o QR code com o Expo Go
```

## Verificações

| Comando                | O que faz                                      |
| ---------------------- | ---------------------------------------------- |
| `npm run verify`       | Tudo abaixo, na ordem usada pelo CI            |
| `npm run format:check` | Prettier (use `npm run format` para corrigir)  |
| `npm run lint`         | ESLint em todos os workspaces                  |
| `npm run typecheck`    | TypeScript strict em todos os workspaces       |
| `npm run test`         | Vitest (shared, web) e Jest/jest-expo (mobile) |
| `npm run build:web`    | Build de produção do site                      |

Rodar em um workspace só: `npm run test -w @gearhead/shared`.

## Variáveis de ambiente

Copie `.env.example` para `apps/web/.env.local` / `apps/mobile/.env.local` quando necessário. Nunca commite segredos; a chave `service_role` do Supabase nunca vai para o cliente.

## Custos

O projeto usa apenas ferramentas gratuitas e execução local. Planos gratuitos têm limites e podem mudar — confira os termos oficiais antes de publicar. Nenhum serviço com cobrança automática deve ser habilitado sem aprovação explícita.

## Documentação

- [Requisitos de produto](docs/PRODUCT_REQUIREMENTS.md)
- [Arquitetura](docs/ARCHITECTURE.md)
- [Modelo de dados](docs/DATA_MODEL.md)
- [Segurança e privacidade](docs/SECURITY.md)
- [Roadmap e backlog](docs/ROADMAP.md)
