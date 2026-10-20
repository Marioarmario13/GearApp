import type { z } from "zod";

/** Estado devolvido pelas Server Actions de formulário. */
export interface FormState {
  error?: string;
  success?: string;
  fieldErrors?: Partial<Record<string, string[]>>;
  /** Valores para repreencher o formulário (nunca inclui senha). */
  values?: Record<string, string>;
}

export function fieldErrorsFrom(error: z.ZodError): Partial<Record<string, string[]>> {
  const result: Partial<Record<string, string[]>> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    (result[key] ??= []).push(issue.message);
  }
  return result;
}

/** Lê campos de texto do FormData, ignorando arquivos e campos sensíveis. */
export function formValues(formData: FormData, omit: string[] = ["password"]) {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !omit.includes(key) && !key.startsWith("$")) {
      values[key] = value;
    }
  }
  return values;
}

/** Aceita apenas caminhos internos para evitar open redirect (ex.: "//evil.com"). */
export function safeNextPath(next: unknown, fallback = "/conta"): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }
  if (next.includes("\\") || next.includes("://")) return fallback;
  return next;
}
