import { describe, expect, it } from "vitest";
import { dataErrorMessage, GearheadDataError } from "./data-core";
import {
  businessInputSchema,
  credentialInputSchema,
  formatPhone,
  formatPostalCode,
  isExpired,
  toBusinessRow,
  validateDocument,
  whatsappLink,
} from "./partner";

const base = { kind: "workshop", name: "Oficina Teste", city: "Recife", state: "PE" };

describe("businessInputSchema", () => {
  it("aceita o mínimo e limpa campos opcionais vazios", () => {
    const parsed = businessInputSchema.parse({
      ...base,
      description: "",
      phone: "",
      email: "",
      website: "",
      postalCode: "",
    });
    expect(parsed).toMatchObject({
      description: null,
      phone: null,
      email: null,
      website: null,
      postalCode: null,
      phoneIsWhatsapp: false,
      specialties: [],
    });
  });

  it("normaliza telefone, CEP, e-mail e site", () => {
    const parsed = businessInputSchema.parse({
      ...base,
      phone: "(81) 99999-0000",
      phoneIsWhatsapp: "on",
      postalCode: "50000-000",
      email: " Contato@Oficina.TEST ",
      website: "oficina.test",
    });
    expect(parsed).toMatchObject({
      phone: "81999990000",
      phoneIsWhatsapp: true,
      postalCode: "50000000",
      email: "contato@oficina.test",
      website: "https://oficina.test",
    });
  });

  it.each([
    ["telefone curto", { phone: "1234" }],
    ["CEP incompleto", { postalCode: "5000" }],
    ["e-mail inválido", { email: "nao-e-email" }],
    ["UF inválida", { state: "XX" }],
    ["tipo inválido", { kind: "banco" }],
    ["nome curto", { name: "A" }],
  ])("rejeita %s", (_label, override) => {
    expect(businessInputSchema.safeParse({ ...base, ...override }).success).toBe(false);
  });

  it("WhatsApp sem telefone não é salvo como verdadeiro", () => {
    const row = toBusinessRow(businessInputSchema.parse({ ...base, phoneIsWhatsapp: true }));
    expect(row.phone_is_whatsapp).toBe(false);
  });
});

describe("credentialInputSchema", () => {
  it("aceita credencial com datas válidas", () => {
    const parsed = credentialInputSchema.parse({
      type: "certification",
      title: "Curso de injeção",
      issuer: "",
      specialtyId: "",
      issuedOn: "2025-01-10",
      expiresOn: "2027-01-10",
    });
    expect(parsed).toMatchObject({ issuer: null, specialtyId: null });
  });

  it("rejeita validade antes da emissão", () => {
    const result = credentialInputSchema.safeParse({
      type: "certification",
      title: "Curso",
      issuedOn: "2025-01-10",
      expiresOn: "2024-01-10",
    });
    expect(result.success).toBe(false);
  });
});

describe("validateDocument", () => {
  it("aceita PDF e imagens até 10 MB", () => {
    expect(validateDocument({ type: "application/pdf", size: 1000 })).toBeNull();
    expect(validateDocument({ type: "image/png", size: 10 * 1024 * 1024 })).toBeNull();
  });

  it("rejeita outros tipos e arquivos grandes", () => {
    expect(validateDocument({ type: "application/zip", size: 10 })).toContain("PDF");
    expect(validateDocument({ type: "application/pdf", size: 10 * 1024 * 1024 + 1 })).toContain(
      "10 MB",
    );
  });
});

describe("formatação", () => {
  it("formata telefone, CEP e link de WhatsApp", () => {
    expect(formatPhone("41999990000")).toBe("(41) 99999-0000");
    expect(formatPhone("4133330000")).toBe("(41) 3333-0000");
    expect(formatPostalCode("80000000")).toBe("80000-000");
    expect(whatsappLink("41999990000", true)).toBe("https://wa.me/5541999990000");
    expect(whatsappLink("41999990000", false)).toBeNull();
  });

  it("identifica credencial vencida", () => {
    const today = new Date("2026-10-20T12:00:00Z");
    expect(isExpired("2026-10-19", today)).toBe(true);
    expect(isExpired("2026-10-20", today)).toBe(false);
    expect(isExpired(null, today)).toBe(false);
  });
});

describe("dataErrorMessage (regras de negócio)", () => {
  it("exibe mensagens GH001 das funções SQL", () => {
    const e = new GearheadDataError(
      "GH001",
      "Para aprovar, confira e aprove antes um documento de registro (CNPJ/MEI)",
    );
    expect(dataErrorMessage(e)).toBe(
      "Para aprovar, confira e aprove antes um documento de registro (CNPJ/MEI).",
    );
  });
});
