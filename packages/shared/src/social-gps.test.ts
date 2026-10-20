import { describe, expect, it } from "vitest";
import { formatAge, formatRemaining, shareInputSchema } from "./social-gps";

const friend = "d6d6d6d6-0000-4000-8000-00000000000b";

describe("shareInputSchema", () => {
  it("aceita compartilhamento válido (minutos vindos de formulário)", () => {
    expect(
      shareInputSchema.parse({
        purpose: "convoy",
        minutes: "60",
        recipientIds: [friend],
        note: "",
      }),
    ).toEqual({
      purpose: "convoy",
      minutes: 60,
      recipientIds: [friend],
      note: null,
    });
  });

  it.each([
    ["sem amigos", { recipientIds: [] }],
    ["duração longa", { minutes: 600 }],
    ["duração curta", { minutes: 1 }],
    ["finalidade inválida", { purpose: "rastrear" }],
  ])("rejeita %s", (_l, override) => {
    expect(
      shareInputSchema.safeParse({
        purpose: "meetup",
        minutes: 30,
        recipientIds: [friend],
        ...override,
      }).success,
    ).toBe(false);
  });
});

describe("formatação", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  it("tempo restante", () => {
    expect(formatRemaining("2026-10-20T12:05:00Z", now)).toBe("faltam 5 min");
    expect(formatRemaining("2026-10-20T13:20:00Z", now)).toBe("faltam 1 h 20 min");
    expect(formatRemaining("2026-10-20T11:59:00Z", now)).toBe("encerrado");
  });
  it("idade da posição", () => {
    expect(formatAge(null, now)).toBe("sem posição ainda");
    expect(formatAge("2026-10-20T11:59:30Z", now)).toBe("agora");
    expect(formatAge("2026-10-20T11:57:00Z", now)).toBe("há 3 min");
  });
});
