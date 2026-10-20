import { z } from "zod";
import { BRAZIL_STATES } from "./profile";

/** Espelha os enums e constraints de supabase/migrations/*_partners.sql. */
export const BUSINESS_KINDS = [
  "workshop",
  "mechanic",
  "tuner",
  "gas_station",
  "parts_store",
  "detailing",
] as const;
export type BusinessKind = (typeof BUSINESS_KINDS)[number];

export const BUSINESS_KIND_LABELS: Record<BusinessKind, string> = {
  workshop: "Oficina",
  mechanic: "Mecânico autônomo",
  tuner: "Preparador",
  gas_station: "Posto de combustível",
  parts_store: "Autopeças",
  detailing: "Estética automotiva",
};

export type BusinessStatus = "pending" | "approved" | "rejected" | "suspended";
export const BUSINESS_STATUS_LABELS: Record<BusinessStatus, string> = {
  pending: "Em análise",
  approved: "Verificado",
  rejected: "Recusado",
  suspended: "Suspenso",
};

export const CREDENTIAL_TYPES = [
  "business_registration",
  "certification",
  "training",
  "other",
] as const;
export type CredentialType = (typeof CREDENTIAL_TYPES)[number];
export const CREDENTIAL_TYPE_LABELS: Record<CredentialType, string> = {
  business_registration: "Registro da empresa (CNPJ/MEI)",
  certification: "Certificação",
  training: "Curso/treinamento",
  other: "Outro documento",
};

export type CredentialStatus = "pending" | "approved" | "rejected";
export const CREDENTIAL_STATUS_LABELS: Record<CredentialStatus, string> = {
  pending: "Em análise",
  approved: "Conferido",
  rejected: "Recusado",
};

export const MAX_BUSINESSES_PER_USER = 3;
export const MAX_SPECIALTIES_PER_BUSINESS = 15;
export const MAX_CREDENTIALS_PER_BUSINESS = 20;

/** Espelha o bucket `business-documents`. */
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_MIME_TYPES = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
export type DocumentMimeType = keyof typeof DOCUMENT_MIME_TYPES;

export function isAllowedDocumentType(type: string): type is DocumentMimeType {
  return Object.hasOwn(DOCUMENT_MIME_TYPES, type);
}

export function validateDocument(file: { type: string; size: number }): string | null {
  if (!isAllowedDocumentType(file.type)) return "Envie um PDF ou uma imagem JPG, PNG ou WebP.";
  if (file.size <= 0) return "Arquivo vazio.";
  if (file.size > DOCUMENT_MAX_BYTES) return "O documento deve ter no máximo 10 MB.";
  return null;
}

const digits = (v: string) => v.replace(/\D/g, "");

/** Texto opcional de formulário: ausente ou vazio vira null. */
const optionalText = (max: number, min = 1) =>
  z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || (v.length >= min && v.length <= max), {
      message: min > 1 ? `Entre ${min} e ${max} caracteres` : `Máximo de ${max} caracteres`,
    });

/** Checkbox de formulário HTML ("on") ou booleano (mobile). */
const checkbox = z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean());

export const businessInputSchema = z.object({
  kind: z.enum(BUSINESS_KINDS, "Escolha o tipo"),
  name: z.string().trim().min(2, "Mínimo de 2 caracteres").max(80, "Máximo de 80 caracteres"),
  description: optionalText(1000),
  phone: z
    .string()
    .nullish()
    .transform((v) => (v ? digits(v) : null))
    .refine((v) => v === null || /^[0-9]{10,11}$/.test(v), "Telefone com DDD (10 ou 11 dígitos)"),
  phoneIsWhatsapp: checkbox,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .nullish()
    .transform((v) => (v ? v : null))
    .refine(
      (v) => v === null || (v.length <= 120 && z.email().safeParse(v).success),
      "E-mail inválido",
    ),
  website: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? (/^https?:\/\//i.test(v) ? v : `https://${v}`) : null))
    .refine(
      (v) => v === null || (v.length <= 200 && z.url().safeParse(v).success),
      "Site inválido",
    ),
  street: optionalText(120),
  streetNumber: optionalText(20),
  district: optionalText(80),
  city: z.string().trim().min(1, "Informe a cidade").max(80, "Máximo de 80 caracteres"),
  state: z.enum(BRAZIL_STATES, "Escolha a UF"),
  postalCode: z
    .string()
    .nullish()
    .transform((v) => (v ? digits(v) : null))
    .refine((v) => v === null || /^[0-9]{8}$/.test(v), "CEP com 8 dígitos"),
  specialties: z
    .array(z.string())
    .max(MAX_SPECIALTIES_PER_BUSINESS, `Escolha até ${MAX_SPECIALTIES_PER_BUSINESS} especialidades`)
    .default([]),
});
export type BusinessInput = z.infer<typeof businessInputSchema>;

export function toBusinessRow(input: BusinessInput) {
  return {
    kind: input.kind,
    name: input.name,
    description: input.description,
    phone: input.phone,
    phone_is_whatsapp: input.phone ? input.phoneIsWhatsapp : false,
    email: input.email,
    website: input.website,
    street: input.street,
    street_number: input.streetNumber,
    district: input.district,
    city: input.city,
    state: input.state,
    postal_code: input.postalCode,
  };
}

const optionalDate = z
  .string()
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida");

export const credentialInputSchema = z
  .object({
    type: z.enum(CREDENTIAL_TYPES, "Escolha o tipo de documento"),
    title: z.string().trim().min(2, "Mínimo de 2 caracteres").max(120, "Máximo de 120 caracteres"),
    issuer: optionalText(120, 2),
    specialtyId: z
      .string()
      .nullish()
      .transform((v) => (v ? v : null)),
    issuedOn: optionalDate,
    expiresOn: optionalDate,
  })
  .refine((c) => !c.issuedOn || !c.expiresOn || c.expiresOn >= c.issuedOn, {
    message: "A validade deve ser depois da emissão",
    path: ["expiresOn"],
  });
export type CredentialInput = z.infer<typeof credentialInputSchema>;

export const reviewNoteSchema = z
  .string()
  .trim()
  .max(500, "Máximo de 500 caracteres")
  .nullish()
  .transform((v) => (v ? v : null));

/** "41999990000" → "(41) 99999-0000". */
export function formatPhone(phone: string | null): string | null {
  if (!phone) return null;
  const m = /^(\d{2})(\d{4,5})(\d{4})$/.exec(phone);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : phone;
}

/** "80000000" → "80000-000". */
export function formatPostalCode(cep: string | null): string | null {
  if (!cep) return null;
  return cep.length === 8 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : cep;
}

/** Link wa.me para telefones marcados como WhatsApp (DDI 55). */
export function whatsappLink(phone: string | null, isWhatsapp: boolean): string | null {
  return phone && isWhatsapp ? `https://wa.me/55${phone}` : null;
}

/** Credencial vencida (expiresOn no passado, comparando datas ISO). */
export function isExpired(expiresOn: string | null, today = new Date()): boolean {
  if (!expiresOn) return false;
  return expiresOn < today.toISOString().slice(0, 10);
}
