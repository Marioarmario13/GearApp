import { z } from "zod";

/** Primeiro ano aceito para veículos cadastrados na garagem. */
export const MIN_VEHICLE_YEAR = 1886;

/** Limites espelhados nos triggers de supabase/migrations/*_garage.sql. */
export const MAX_VEHICLES_PER_USER = 20;
export const MAX_PHOTOS_PER_VEHICLE = 10;

/** Espelha o bucket `vehicle-photos` (file_size_limit / allowed_mime_types). */
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_MIME_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
export type PhotoMimeType = keyof typeof PHOTO_MIME_TYPES;

export function isAllowedPhotoType(type: string): type is PhotoMimeType {
  return Object.hasOwn(PHOTO_MIME_TYPES, type);
}

/**
 * Placa brasileira: formato antigo (ABC1234) ou Mercosul (ABC1D23).
 * Aceita hífen e minúsculas na entrada; normaliza para maiúsculas sem hífen.
 */
export const PLATE_PATTERN = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

export function normalizePlate(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

export function isValidPlate(input: string): boolean {
  return PLATE_PATTERN.test(normalizePlate(input));
}

export const vehicleVisibilitySchema = z.enum(["public", "private"]);
export type VehicleVisibility = z.infer<typeof vehicleVisibilitySchema>;

export const VISIBILITY_LABELS: Record<VehicleVisibility, string> = {
  public: "Público",
  private: "Privado",
};

/** Texto opcional de formulário: ausente ou vazio vira null (limpa o valor no banco). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .nullish()
    .transform((v) => (v ? v : null));

/**
 * Schema de entrada para criar/editar veículo. Aceita valores vindos de formulário
 * (ano como string). O banco valida de novo (constraints, triggers e RLS).
 */
export function vehicleInputSchema(now: Date = new Date()) {
  const maxYear = now.getFullYear() + 1;
  return z.object({
    make: z.string().trim().min(1, "Informe a marca").max(60, "Máximo de 60 caracteres"),
    model: z.string().trim().min(1, "Informe o modelo").max(80, "Máximo de 80 caracteres"),
    year: z.preprocess(
      (v) => (typeof v === "string" ? (v.trim() === "" ? undefined : Number(v)) : v),
      z
        .number("Informe o ano")
        .int("Ano deve ser inteiro")
        .min(MIN_VEHICLE_YEAR, `Ano mínimo: ${MIN_VEHICLE_YEAR}`)
        .max(maxYear, `Ano máximo: ${maxYear}`),
    ),
    nickname: optionalText(60),
    plate: z
      .string()
      .nullish()
      .transform((v) => (v && v.trim() ? normalizePlate(v) : null))
      .refine((v) => v === null || PLATE_PATTERN.test(v), "Placa inválida (ex.: ABC1D23)"),
    visibility: vehicleVisibilitySchema.default("private"),
  });
}

export type VehicleInput = z.infer<ReturnType<typeof vehicleInputSchema>>;

/** Nome de exibição: apelido ou "Marca Modelo Ano". */
export function vehicleTitle(v: {
  make: string;
  model: string;
  year: number;
  nickname?: string | null;
}) {
  return v.nickname || `${v.make} ${v.model} ${v.year}`;
}
