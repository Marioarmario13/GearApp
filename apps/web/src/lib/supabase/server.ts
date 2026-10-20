import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { getSupabaseEnv } from "@/lib/env";

/** Cliente Supabase por requisição (Server Components, Server Actions, Route Handlers). */
export async function createClient() {
  // Auth sempre em tempo de requisição: o SDK usa Date.now() para validar a sessão,
  // o que não pode acontecer em prerender/prefetch parcial (Cache Components).
  await connection();
  const cookieStore = await cookies();
  const { url, key } = getSupabaseEnv();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Chamado a partir de um Server Component, onde cookies são somente leitura.
          // O proxy (src/proxy.ts) já renova a sessão a cada requisição.
        }
      },
    },
  });
}
