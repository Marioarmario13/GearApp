import { z } from "zod";

/** Primeiro ano aceito para veículos cadastrados na garagem. */
export const MIN_VEHICLE_YEAR = 1886;

/**
 * Placa brasileira: formato antigo (ABC1234) ou Mercosul (ABC1D23).
 * Aceita hífen e minúsculas na entrada; normaliza para maiúsculas sem hífen.
 */
const PLATE_PATTERN = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

export function normalizePlate(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

export function isValidPlate(input: string): boolean {
  return PLATE_PATTERN.test(normalizePlate(input));
}

export const vehicleVisibilitySchema = z.enum(["public", "private"]);
export type VehicleVisibility = z.infer<typeof vehicleVisibilitySchema>;

/**
 * Schema de entrada para criar/editar veículo. A validação também será aplicada
 * no servidor (constraints + RLS) na Etapa 3 — este schema não é a única proteção.
 */
export function vehicleInputSchema(now: Date = new Date()) {
  const maxYear = now.getFullYear() + 1;
  return z.object({
    make: z.string().trim().min(1, "Informe a marca").max(60),
    model: z.string().trim().min(1, "Informe o modelo").max(80),
    year: z
      .number()
      .int("Ano deve ser inteiro")
      .min(MIN_VEHICLE_YEAR, `Ano mínimo: ${MIN_VEHICLE_YEAR}`)
      .max(maxYear, `Ano máximo: ${maxYear}`),
    nickname: z.string().trim().max(60).optional(),
    plate: z
      .string()
      .optional()
      .transform((v) => (v ? normalizePlate(v) : undefined))
      .refine((v) => v === undefined || PLATE_PATTERN.test(v), "Placa inválida"),
    visibility: vehicleVisibilitySchema.default("private"),
  });
}

export type VehicleInput = z.infer<ReturnType<typeof vehicleInputSchema>>;
