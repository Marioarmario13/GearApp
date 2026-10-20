import { describe, expect, it } from "vitest";
import { normalizePeopleQuery, reportInputSchema, reportTargetPath } from "./community";

describe("reportInputSchema", () => {
  const base = {
    targetType: "vehicle",
    targetId: "c4c4c4c4-0000-4000-8000-000000000001",
    reason: "spam",
  };

  it("aceita denúncia válida e limpa detalhes vazios", () => {
    expect(reportInputSchema.parse({ ...base, details: "  " })).toMatchObject({ details: null });
  });

  it.each([
    ["alvo inválido", { targetType: "comment" }],
    ["id inválido", { targetId: "abc" }],
    ["motivo inválido", { reason: "chato" }],
    ["detalhes longos", { details: "x".repeat(1001) }],
  ])("rejeita %s", (_l, override) => {
    expect(reportInputSchema.safeParse({ ...base, ...override }).success).toBe(false);
  });
});

describe("reportTargetPath", () => {
  it("aponta para a página de cada tipo de alvo", () => {
    expect(reportTargetPath("event", "e1")).toBe("/eventos/e1");
    expect(reportTargetPath("business", "b1")).toBe("/admin/parceiros/b1");
    expect(reportTargetPath("profile", "p1", "piloto")).toBe("/u/piloto");
    expect(reportTargetPath("profile", "p1", null)).toBeNull();
  });
});

describe("normalizePeopleQuery", () => {
  it("normaliza @, espaços e maiúsculas", () => {
    expect(normalizePeopleQuery("  @Piloto ")).toBe("piloto");
  });
  it.each(["ab", " @ab ", "a".repeat(31)])("recusa %j", (q) => {
    expect(normalizePeopleQuery(q)).toBeNull();
  });
});
