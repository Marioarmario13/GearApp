import { describe, expect, it } from "vitest";
import { dataErrorMessage, GearheadDataError, validatePhoto } from "./garage-data";

describe("validatePhoto", () => {
  it("aceita JPG/PNG/WebP até 5 MB", () => {
    expect(validatePhoto({ type: "image/jpeg", size: 1000 })).toBeNull();
    expect(validatePhoto({ type: "image/webp", size: 5 * 1024 * 1024 })).toBeNull();
  });

  it.each([
    [{ type: "image/gif", size: 10 }, "JPG"],
    [{ type: "application/pdf", size: 10 }, "JPG"],
    [{ type: "image/png", size: 0 }, "vazio"],
    [{ type: "image/png", size: 5 * 1024 * 1024 + 1 }, "5 MB"],
  ])("rejeita %o", (file, expected) => {
    expect(validatePhoto(file)).toContain(expected);
  });
});

describe("dataErrorMessage", () => {
  it("mostra mensagens de limite vindas dos triggers", () => {
    const e = new GearheadDataError("23514", "Limite de 20 veículos por usuário atingido");
    expect(dataErrorMessage(e)).toBe("Limite de 20 veículos por usuário atingido.");
  });

  it("esconde mensagens internas de constraint", () => {
    const e = new GearheadDataError(
      "23514",
      'new row violates check constraint "vehicles_make_length"',
    );
    expect(dataErrorMessage(e)).toBe("Algum campo está em formato inválido.");
  });

  it("trata erros desconhecidos de forma genérica", () => {
    expect(dataErrorMessage(new Error("boom"))).toBe(
      "Não foi possível concluir a operação. Tente novamente.",
    );
  });
});
