# Privacidade e LGPD — Gearhead

> Documento técnico de apoio. **Não é aconselhamento jurídico.** Itens marcados **[JURÍDICO]** precisam de revisão por profissional antes do piloto público. Base: Lei nº 13.709/2018 (LGPD).

## Dados tratados

| Dado                                   | Onde                                      | Finalidade                              | Quem vê                                                     | Retenção atual                                  |
| -------------------------------------- | ----------------------------------------- | --------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------- |
| E-mail e senha (hash)                  | Supabase Auth                             | Conta e login                           | Só o titular                                                | Até a exclusão da conta                         |
| Perfil (nome, username, cidade/UF)     | `profiles`                                | Identificação na comunidade             | Usuários logados (exceto em caso de bloqueio)               | Até a exclusão                                  |
| Veículos, fotos e placa                | `vehicles`, `vehicle_photos`, Storage     | Garagem virtual                         | Dono; terceiros só se público (placa **nunca**)             | Até o dono excluir                              |
| Parceiros e documentos (CNPJ/MEI etc.) | `businesses`, `credentials`, Storage      | Diretório verificado                    | Dados públicos se aprovado; documentos só dono e admins     | Até a exclusão (**[JURÍDICO]** prazo de guarda) |
| Eventos e presenças                    | `events`, `event_attendees`               | Encontros                               | Total público; lista nominal só organizador                 | Até a exclusão                                  |
| Cupons                                 | `coupons`                                 | Benefícios                              | Titular e o parceiro da oferta                              | Até a exclusão                                  |
| Amizades, bloqueios, denúncias         | `friendships`, `blocks`, `reports`        | Comunidade e segurança                  | Participantes; bloqueios só quem bloqueou; denúncias admins | Até a exclusão                                  |
| **Localização compartilhada**          | `location_sessions` (só a última posição) | Encontro/comboio/segurança com amigos   | Só os amigos escolhidos, durante o prazo                    | Apagada ao encerrar/expirar (máx. 8 h)          |
| Presença aproximada (célula ~5,5 km)   | `ephemeral_presence`                      | Descobrir amigos por perto              | Amigos (só faixa de distância)                              | Até 2 h                                         |
| Posição para o radar                   | não armazenada                            | Buscar parceiros por perto              | Ninguém (arredondada ~1 km, só na consulta)                 | Não é guardada                                  |
| Registros de auditoria                 | `audit_logs`                              | Responsabilização de ações de moderação | Admins                                                      | **[JURÍDICO]** definir prazo                    |

## Bases legais propostas **[JURÍDICO]**

- Execução de contrato (art. 7º, V): conta, garagem, parceiros, eventos, cupons.
- **Consentimento** (art. 7º, I), específico e revogável a qualquer momento: localização compartilhada e presença aproximada (opt-in por sessão).
- Legítimo interesse (art. 7º, IX) com teste de balanceamento: segurança, prevenção a fraudes, moderação e auditoria.
- Documentos de parceiros: verificar se há dados de pessoa física (MEI) e a base adequada.

## Direitos do titular (art. 18) — como exercer

| Direito                           | Implementado                                                         |
| --------------------------------- | -------------------------------------------------------------------- |
| Confirmação e acesso              | Site → Minha conta → **Baixar meus dados** (JSON completo)           |
| Portabilidade                     | Mesmo arquivo JSON (formato aberto)                                  |
| Correção                          | Edição de perfil, veículos, parceiros e eventos                      |
| Eliminação                        | Site → Minha conta → **Excluir minha conta** (dados e arquivos)      |
| Revogação do consentimento        | Parar compartilhamento/presença a qualquer momento (efeito imediato) |
| Informação sobre compartilhamento | Este documento (operadores abaixo)                                   |
| Oposição/revisão                  | **[JURÍDICO]** canal de contato do encarregado (DPO) a definir       |

## Operadores e transferências **[JURÍDICO]**

- **Supabase** (banco, autenticação, arquivos): região a escolher na implantação; avaliar transferência internacional (arts. 33–36) e contrato de tratamento.
- **OpenFreeMap / OpenStreetMap** (mapas): recebem o IP e a área do mapa visualizada ao baixar os tiles; não recebem dados de conta.
- **unpkg** (biblioteca de mapas no app): recebe o IP ao carregar a biblioteca.
- Sem analytics, publicidade ou rastreadores de terceiros.

## Medidas de segurança

Ver [`SECURITY.md`](./SECURITY.md): RLS em todas as tabelas, grants por coluna, auditoria, bloqueios no banco, arquivos privados com URLs assinadas curtas, localização efêmera e cabeçalhos HTTP de segurança.

## Pendências para o piloto **[JURÍDICO]**

1. Termos de uso e política de privacidade (linguagem simples), aceitos no cadastro.
2. Encarregado (DPO) e canal de atendimento ao titular.
3. Prazos de retenção (auditoria, documentos de parceiros, denúncias resolvidas).
4. Avaliação de impacto (RIPD) para localização compartilhada.
5. Plano de resposta a incidentes com comunicação à ANPD e aos titulares (art. 48).
6. Idade mínima e tratamento de dados de menores (art. 14).
