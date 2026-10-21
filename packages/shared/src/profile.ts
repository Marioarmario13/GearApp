import { z } from "zod";

/** Mesmas regras das constraints em supabase/migrations/*_profiles.sql. */
export const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;
export const PASSWORD_MIN_LENGTH = 8;

export const BRAZIL_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const; // prettier-ignore

export type BrazilState = (typeof BRAZIL_STATES)[number];

export const appRoleSchema = z.enum(["user", "admin"]);
export type AppRole = z.infer<typeof appRoleSchema>;

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_PATTERN, "Use de 3 a 30 caracteres: letras minúsculas, números ou _");

export const emailSchema = z.string().trim().toLowerCase().email("E-mail inválido");

/** Espelha `password_requirements = "letters_digits"` do Supabase Auth. */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres`)
  .max(72, "A senha deve ter no máximo 72 caracteres")
  .regex(/[a-zA-Z]/, "A senha deve conter letras")
  .regex(/[0-9]/, "A senha deve conter números");

const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Informe um nome")
  .max(60, "Máximo de 60 caracteres");

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  username: usernameSchema,
  displayName: displayNameSchema,
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe a senha"),
});
export type SignInInput = z.infer<typeof signInSchema>;

/** Campo opcional de formulário: string vazia vira null (limpa o valor no banco). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .transform((v) => (v === "" ? null : v));

export const profileUpdateSchema = z.object({
  username: usernameSchema,
  displayName: displayNameSchema,
  city: optionalText(80),
  state: z
    .union([z.literal(""), z.enum(BRAZIL_STATES, "UF inválida")])
    .transform((v) => (v === "" ? null : v)),
});
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

/** Converte o input validado para as colunas de public.profiles. */
export function toProfileRow(input: ProfileUpdateInput) {
  return {
    username: input.username,
    display_name: input.displayName,
    city: input.city,
    state: input.state,
  };
}

/** Linha pública de public.profiles (sem `role`, que não é legível pelo cliente). */
export interface PublicProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  city: string | null;
  state: BrazilState | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Traduz mensagens de erro do Supabase Auth/PostgREST para pt-BR.
 * Recebe apenas código/mensagem — não depende do SDK.
 */
/** Texto exato devolvido pelo banco e pelo hook do Auth para conta suspensa. */
export const ACCOUNT_SUSPENDED_MESSAGE = "Sua conta está suspensa. Fale com a equipe Gearhead.";

export function isAccountSuspendedError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    error.message === ACCOUNT_SUSPENDED_MESSAGE
  );
}

export function authErrorMessage(error: { code?: string; message?: string }): string {
  if (isAccountSuspendedError(error)) return ACCOUNT_SUSPENDED_MESSAGE;
  switch (error.code) {
    case "invalid_credentials":
      return "E-mail ou senha incorretos.";
    case "user_already_exists":
    case "email_exists":
      return "Já existe uma conta com este e-mail.";
    case "weak_password":
      return "Senha fraca: use pelo menos 8 caracteres com letras e números.";
    case "email_not_confirmed":
      return "Confirme seu e-mail antes de entrar.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Muitas tentativas. Aguarde um pouco e tente novamente.";
    case "23505":
      return "Este nome de usuário já está em uso.";
    case "23514":
      return "Algum campo está em formato inválido.";
    default:
      return "Não foi possível concluir a operação. Tente novamente.";
  }
}
