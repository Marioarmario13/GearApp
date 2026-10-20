# Segurança e Privacidade — Gearhead

> Status: diretrizes iniciais (Etapa 0). Itens marcados **[JURÍDICO]** precisam de revisão por profissional antes da publicação.

## Princípios

1. **Servidor é a fonte da verdade.** Esconder botões na UI não é controle de acesso. Toda regra crítica é aplicada por RLS, constraints ou funções no banco.
2. **Menor privilégio.** RLS habilitada em toda tabela exposta; políticas separadas para SELECT/INSERT/UPDATE/DELETE.
3. **Sem segredos no cliente.** Apenas chaves públicas (`anon`/publishable) em `NEXT_PUBLIC_*`/`EXPO_PUBLIC_*`. `service_role` só em ambiente de servidor confiável — nunca no repositório.
4. **Campos protegidos.** Usuário não altera `owner_id`, `role`, `status`, `verified_at`. Testes de escalonamento de privilégio são obrigatórios.
5. **Uploads restritos.** Buckets com limite de tamanho e MIME; documentos de credenciais em bucket privado.
6. **Auditoria.** Ações administrativas registradas em `audit_logs` (Etapa 7).

## Controles implementados (Etapa 2)

- RLS habilitada em `profiles`; `auto_expose_new_tables = false` (grant explícito obrigatório).
- Grants por coluna impedem cliente de ler/alterar `role` e `id`; troca de papel só via `set_user_role()` com verificação de admin no banco.
- Funções `security definer` com `search_path = ''` e `EXECUTE` revogado de `public`/`anon`.
- Senha mínima de 8 caracteres com letras e números (Supabase Auth + Zod).
- Web: proxy só faz redirecionamento otimista; páginas e Server Actions revalidam o usuário (`getUser()`); `next` de login validado contra open redirect.
- Erros do Auth/PostgREST traduzidos por código, sem expor mensagens internas.
- Verificado: 26 testes pgTAP + checagens pela API REST (anon bloqueado; usuário comum não se promove nem edita perfil alheio).

## Controles implementados (Etapa 3 — garagem)

- Veículo privado por padrão; terceiros só veem veículos públicos (RLS). Página web de veículo privado alheio responde 404.
- Placa isolada em `vehicle_private`: nunca é retornada a terceiros, nem em veículo público.
- `owner_id` e `id` sem grant de escrita: não dá para criar em nome de outro nem transferir veículo.
- Bucket privado; políticas de Storage por pasta do dono + verificação de propriedade do veículo; terceiros só leem fotos registradas de veículos públicos. Tornar o veículo privado bloqueia novas URLs na hora.
- URLs assinadas com validade de 10 min (uma URL já emitida vale até expirar).
- Limites anti-abuso no banco: 20 veículos/usuário, 10 fotos/veículo, 5 MB, tipos de imagem restritos (bucket + validação no cliente/servidor). O mobile converte para JPEG antes do upload.
- Verificado: 35 testes pgTAP da garagem, 6 testes de integração com API/Storage reais e checagem manual no navegador (dono x outro usuário).

### Pendências conhecidas

- Confirmação de e-mail está desligada **apenas no ambiente local** (`enable_confirmations = false`); ligar em qualquer ambiente hospedado.
- Leitura de perfis está aberta a qualquer autenticado; revisar com bloqueios (Etapa 7) e privacidade de perfil.
- Rate limiting e CAPTCHA de cadastro a definir antes do piloto (Etapa 9).
- Metadados EXIF (inclusive GPS) de fotos enviadas pelo **web** não são removidos; o mobile reprocessa a imagem. Remover EXIF no servidor antes do piloto.
- Arquivos órfãos no Storage (falha ao remover depois de apagar a linha) — limpeza periódica na Etapa 9.

## Localização (Etapas 5 e 8)

- Desligada por padrão; pedido de permissão contextual.
- Compartilhamento por **finalidade, destinatário e prazo**; revogação imediata; expiração automática.
- Coordenadas exatas somente para destinatários autorizados; descoberta usa presença aproximada.
- Sem rastreamento oculto e sem histórico permanente desnecessário.
- Frequência de atualização de GPS mínima necessária.
- Testar abuso, enumeração (ex.: triangulação por distância) e tentativas de contornar bloqueios.

## LGPD [JURÍDICO]

- Termos de uso e política de privacidade.
- Base legal por tratamento (consentimento para localização).
- Política de retenção e exclusão.
- Direitos do titular: acesso, correção, exclusão, portabilidade.
- Encarregado (DPO) e canal de contato.

## Checklist por etapa

- [ ] RLS testada (permitido e negado) para cada operação.
- [ ] Teste de escalonamento de privilégio.
- [ ] Políticas de Storage testadas.
- [ ] Nenhum segredo commitado (`.env*` no `.gitignore`).
