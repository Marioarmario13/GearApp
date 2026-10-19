# Requisitos de Produto — Gearhead

> Status: rascunho inicial (Etapa 0). Hipóteses marcadas com **[H]** precisam de validação com usuários reais.

## Visão

Plataforma brasileira para entusiastas automotivos ("gearheads"), com site responsivo e aplicativo Android/iOS, que une:

- diretório de mecânicos, oficinas e preparadores com credenciais verificadas;
- postos e estabelecimentos parceiros com benefícios;
- eventos automotivos;
- garagem virtual;
- comunidade;
- radar geográfico;
- posteriormente, GPS social com consentimento explícito.

## Público-alvo [H]

| Persona                        | Necessidade principal                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| Entusiasta (dono de veículo)   | Encontrar profissionais confiáveis, eventos e benefícios perto de si; exibir a garagem. |
| Profissional / estabelecimento | Ser encontrado por clientes qualificados; comprovar especialidade e certificações.      |
| Organizador de eventos         | Divulgar eventos e controlar inscrições/presenças.                                      |
| Administrador/moderador        | Aprovar parceiros, verificar documentos, moderar conteúdo e denúncias.                  |

## Escopo do MVP

1. **Autenticação e perfil** — cadastro/login por e-mail; perfil público mínimo (apelido, cidade, avatar).
2. **Garagem** — CRUD de veículos com fotos; visibilidade pública/privada por veículo.
3. **Diretório** — estabelecimentos e profissionais, especialidades, horário, contato e localização.
4. **Verificação de credenciais** — envio de documentos privados; aprovação administrativa; selo "verificado" só após conferência documentada.
5. **Radar básico** — busca por raio (PostGIS), filtros por categoria/especialidade, resultados em lista e mapa.
6. **Eventos** — criação, listagem, confirmação de presença.
7. **Ofertas simples** — ofertas e cupons com validade e regras de resgate validadas no servidor (sem carteira financeira).
8. **Painel de aprovação** — fila de parceiros e documentos pendentes; ações auditadas.

## Pós-MVP

- Comunidade ampliada: amizades, bloqueios, denúncias, moderação.
- Presença aproximada para descoberta.
- GPS social: sessões temporárias, destinatários autorizados, revogação e expiração.
- Desafios: navegação, comboio, checkpoints, quiz e check-in.

## Fora de escopo (permanente)

- Competição de velocidade em vias públicas ou pontuação por direção imprudente.
- Cronometragem fora de pista/ambiente apropriado e autorizado.
- Carteira financeira, pagamentos dentro do app (até decisão explícita).

## Requisitos não funcionais

- Português brasileiro; responsivo; acessível (WCAG 2.1 AA como meta).
- Estados de carregamento, vazio e erro em todas as telas.
- Validação e autorização no servidor (RLS + validação Zod compartilhada).
- Paginação e limites de resposta em todas as listagens.
- Localização desligada por padrão; LGPD considerada desde o desenho (ver `SECURITY.md`).
- Custo zero na fase de protótipo: nenhum serviço com cobrança automática.

## Critérios de aceitação por módulo

Detalhados por etapa em [`ROADMAP.md`](./ROADMAP.md).
