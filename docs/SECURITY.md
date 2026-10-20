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

### Pendências conhecidas

- Confirmação de e-mail está desligada **apenas no ambiente local** (`enable_confirmations = false`); ligar em qualquer ambiente hospedado.
- Leitura de perfis está aberta a qualquer autenticado; revisar com bloqueios (Etapa 7) e privacidade de perfil.
- Rate limiting e CAPTCHA de cadastro a definir antes do piloto (Etapa 9).

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
