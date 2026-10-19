import { describe, expect, it } from "vitest";
import { isValidPlate, normalizePlate, vehicleInputSchema } from "./vehicle";

const now = new Date("2026-06-01T12:00:00Z");

describe("normalizePlate", () => {
  it("remove hífen/espaços e converte para maiúsculas", () => {
    expect(normalizePlate("abc-1d23")).toBe("ABC1D23");
    expect(normalizePlate(" abc 1234 ")).toBe("ABC1234");
  });
});

describe("isValidPlate", () => {
  it.each(["ABC1234", "ABC1D23", "abc-1234"])("aceita %s", (plate) => {
    expect(isValidPlate(plate)).toBe(true);
  });

  it.each(["AB1234", "ABCD123", "1234ABC", "ABC12345", ""])("rejeita %s", (plate) => {
    expect(isValidPlate(plate)).toBe(false);
  });
});

describe("vehicleInputSchema", () => {
  const schema = vehicleInputSchema(now);

  it("aceita veículo válido e aplica visibilidade privada por padrão", () => {
    const result = schema.parse({ make: "Volkswagen", model: "Fusca", year: 1972 });
    expect(result.visibility).toBe("private");
    expect(result.plate).toBeUndefined();
  });

  it("normaliza a placa", () => {
    const result = schema.parse({ make: "Fiat", model: "Uno", year: 2010, plate: "xyz-9a87" });
    expect(result.plate).toBe("XYZ9A87");
  });

  it("rejeita placa inválida", () => {
    const result = schema.safeParse({ make: "Fiat", model: "Uno", year: 2010, plate: "12345" });
    expect(result.success).toBe(false);
  });

  it("rejeita ano futuro além do próximo ano-modelo", () => {
    expect(schema.safeParse({ make: "X", model: "Y", year: 2027 }).success).toBe(true);
    expect(schema.safeParse({ make: "X", model: "Y", year: 2028 }).success).toBe(false);
  });

  it("rejeita marca vazia após trim", () => {
    expect(schema.safeParse({ make: "   ", model: "Y", year: 2000 }).success).toBe(false);
  });
});
