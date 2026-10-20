import { describe, expect, it } from "vitest";
import { eventInputSchema, formatEventPeriod, spotsLeft, toLocalInputValue } from "./events";
import {
  effectiveCouponStatus,
  formatCouponCode,
  offerInputSchema,
  offerRemaining,
} from "./offers";

const now = new Date("2026-10-20T12:00:00-03:00");

describe("eventInputSchema", () => {
  const base = {
    kind: "meetup",
    title: "Encontro",
    startsAt: "2026-11-01T09:00",
    endsAt: "2026-11-01T13:00",
    venueName: "Praça",
    city: "Recife",
    state: "PE",
    capacity: "",
  };

  it("interpreta datetime-local como horário de Brasília e limpa campos vazios", () => {
    const e = eventInputSchema(now).parse(base);
    expect(e.startsAt.toISOString()).toBe("2026-11-01T12:00:00.000Z");
    expect(e).toMatchObject({ capacity: null, businessId: null, description: null });
  });

  it.each([
    ["no passado", { startsAt: "2026-10-01T09:00", endsAt: "2026-10-01T10:00" }],
    ["fim antes do início", { endsAt: "2026-11-01T08:00" }],
    ["mais de 7 dias", { endsAt: "2026-11-09T09:00" }],
    ["capacidade zero", { capacity: "0" }],
    ["tipo inválido", { kind: "racha" }],
  ])("rejeita evento %s", (_l, override) => {
    expect(eventInputSchema(now).safeParse({ ...base, ...override }).success).toBe(false);
  });
});

describe("formatação de eventos", () => {
  it("formata período no fuso de Brasília", () => {
    expect(formatEventPeriod("2026-11-01T12:00:00Z", "2026-11-01T16:00:00Z")).toMatch(
      /09:00–13:00$/,
    );
  });
  it("converte ISO para datetime-local de Brasília", () => {
    expect(toLocalInputValue("2026-11-01T12:00:00Z")).toBe("2026-11-01T09:00");
  });
  it("calcula vagas restantes", () => {
    expect(spotsLeft({ capacity: 10, attendee_count: 7 })).toBe(3);
    expect(spotsLeft({ capacity: null, attendee_count: 7 })).toBeNull();
  });
});

describe("offerInputSchema", () => {
  it("aceita oferta válida com padrões", () => {
    const o = offerInputSchema(now).parse({
      title: "Troca de óleo",
      discountLabel: "10% OFF",
      endsOn: "2026-12-31",
      maxRedemptions: "",
      perUserLimit: "",
    });
    expect(o).toMatchObject({ maxRedemptions: null, perUserLimit: 1 });
    expect(o.endsOn.toISOString()).toBe("2027-01-01T02:59:59.000Z");
  });

  it.each([
    ["vencida", { endsOn: "2026-10-01" }],
    ["validade acima de 1 ano", { endsOn: "2028-01-01" }],
    ["limite por usuário 11", { perUserLimit: "11" }],
  ])("rejeita oferta %s", (_l, override) => {
    const base = { title: "Oferta", discountLabel: "5%", endsOn: "2026-12-31" };
    expect(offerInputSchema(now).safeParse({ ...base, ...override }).success).toBe(false);
  });
});

describe("cupons", () => {
  it("status efetivo considera vencimento", () => {
    expect(
      effectiveCouponStatus({ status: "issued", expires_at: "2026-10-19T00:00:00Z" }, now),
    ).toBe("expired");
    expect(
      effectiveCouponStatus({ status: "redeemed", expires_at: "2026-10-19T00:00:00Z" }, now),
    ).toBe("redeemed");
  });
  it("formata o código e o saldo da oferta", () => {
    expect(formatCouponCode("ABCD2345")).toBe("ABCD-2345");
    expect(offerRemaining({ max_redemptions: 5, issued_count: 2 })).toBe(3);
    expect(offerRemaining({ max_redemptions: null, issued_count: 2 })).toBeNull();
  });
});
