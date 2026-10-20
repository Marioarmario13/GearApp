import "server-only";
import type { AppRole, PublicProfile } from "@gearhead/shared";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface CurrentUser {
  id: string;
  email: string | null;
}

/**
 * Camada de acesso a dados (DAL) para autenticação. getUser() valida o token
 * com o servidor de Auth — use-o para decisões de autorização no servidor.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  return user;
}

const PROFILE_COLUMNS =
  "id, username, display_name, city, state, avatar_url, created_at, updated_at";

export async function getMyProfile(userId: string): Promise<PublicProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle<PublicProfile>();
  if (error) throw new Error(`Falha ao carregar perfil: ${error.message}`);
  return data;
}

export async function getMyRole(): Promise<AppRole | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("current_user_role");
  if (error) throw new Error(`Falha ao carregar papel: ${error.message}`);
  return (data as AppRole | null) ?? null;
}
