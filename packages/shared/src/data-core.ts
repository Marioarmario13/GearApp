import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { authErrorMessage } from "./profile";

/**
 * Base da camada de dados compartilhada (web e mobile). As funções recebem o
 * cliente Supabase autenticado do chamador: toda autorização é aplicada pelo
 * banco (RLS, grants e políticas do Storage) — elas não substituem essa proteção.
 */
export type GearheadClient = SupabaseClient<Database>;

export class GearheadDataError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "GearheadDataError";
  }
}

/** Códigos criados na própria camada de dados, com mensagem pt-BR pronta para a UI. */
const OWN_MESSAGE_CODES = new Set(["invalid_photo", "photo_limit", "invalid_file", "not_found"]);

/** Mensagem pt-BR segura para exibir na UI a partir de um erro da camada de dados. */
export function dataErrorMessage(e: unknown): string {
  if (e instanceof GearheadDataError) {
    if (OWN_MESSAGE_CODES.has(e.code)) return e.message;
    // GH001: regra de negócio levantada pelas nossas funções SQL, já em pt-BR.
    if (e.code === "GH001") return e.message.endsWith(".") ? e.message : `${e.message}.`;
    switch (e.code) {
      case "storage_error":
        return "Falha ao enviar ou remover o arquivo. Tente novamente.";
      case "23514":
        // Mensagens de limite vêm dos nossos triggers, já em pt-BR.
        return e.message.startsWith("Limite")
          ? `${e.message}.`
          : "Algum campo está em formato inválido.";
      case "23503":
        return "Algum item selecionado não existe mais. Recarregue a página.";
      case "42501":
        return "Você não tem permissão para esta ação.";
      case "P0002":
        return "Registro não encontrado.";
      default:
        return authErrorMessage({ code: e.code });
    }
  }
  return "Não foi possível concluir a operação. Tente novamente.";
}

export function fail(error: { code?: string; message: string }): never {
  throw new GearheadDataError(error.code ?? "unknown", error.message);
}

export function randomFileName() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** URLs assinadas de um bucket privado. Caminhos sem permissão de leitura são omitidos. */
export async function signStorageUrls(
  client: GearheadClient,
  bucket: string,
  paths: string[],
  expiresIn: number,
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await client.storage.from(bucket).createSignedUrls(paths, expiresIn);
  if (error) fail({ code: "storage_error", message: error.message });
  const urls: Record<string, string> = {};
  for (const item of data) {
    if (item.path && item.signedUrl && !item.error) urls[item.path] = item.signedUrl;
  }
  return urls;
}
