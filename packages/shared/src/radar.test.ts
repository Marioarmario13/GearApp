import { describe, expect, it } from "vitest";
import {
  businessLocationSchema,
  clampRadius,
  coarsenCoordinate,
  formatDistance,
  isInsideBrazil,
} from "./radar";

describe("coarsenCoordinate", () => {
  it("arredonda para ~1 km (2 casas decimais)", () => {
    expect(coarsenCoordinate(-25.428412)).toBe(-25.43);
    expect(coarsenCoordinate(-49.273349)).toBe(-49.27);
  });
});

describe("isInsideBrazil / businessLocationSchema", () => {
  it("aceita pontos no Brasil, inclusive vindos de formulário", () => {
    expect(isInsideBrazil(-25.43, -49.27)).toBe(true);
    expect(businessLocationSchema.parse({ latitude: "-25.43", longitude: "-49.27" })).toEqual({
      latitude: -25.43,
      longitude: -49.27,
    });
  });

  it.each([
    ["Nova York", { latitude: 40.7, longitude: -74 }],
    ["Lisboa", { latitude: 38.7, longitude: -9.1 }],
    ["vazio", { latitude: "", longitude: "" }],
    ["texto", { latitude: "abc", longitude: "-49" }],
  ])("rejeita %s", (_label, value) => {
    expect(businessLocationSchema.safeParse(value).success).toBe(false);
  });
});

describe("clampRadius", () => {
  it("limita ao intervalo 1–100 km e usa 10 km por padrão", () => {
    expect(clampRadius(undefined)).toBe(10);
    expect(clampRadius(0)).toBe(10);
    expect(clampRadius(0.2)).toBe(1);
    expect(clampRadius(500)).toBe(100);
    expect(clampRadius(25)).toBe(25);
  });
});

describe("formatDistance", () => {
  it("formata metros e quilômetros em pt-BR", () => {
    expect(formatDistance(347)).toBe("350 m");
    expect(formatDistance(4210)).toBe("4,2 km");
    expect(formatDistance(37400)).toBe("37 km");
  });
});
