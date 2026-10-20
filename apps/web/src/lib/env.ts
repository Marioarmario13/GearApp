/**
 * Variáveis públicas do Supabase. Somente a chave *publishable* (equivalente à anon)
 * pode aparecer aqui — nunca a secret/service_role.
 */
export function getSupabaseEnv() {
  // Acesso literal a process.env.NEXT_PUBLIC_* é necessário para o Next embutir os valores.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY em apps/web/.env.local (veja .env.example).",
    );
  }
  return { url, key };
}
