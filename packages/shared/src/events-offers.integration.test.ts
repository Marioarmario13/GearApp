/**
 * Integração com o Supabase LOCAL (API real). Roda via `npm run test:integration`.
 * Usa usuários, parceiro, evento e oferta fictícios de supabase/seed.sql.
 */
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { GearheadClient } from "./data-core";
import type { Database } from "./database.types";
import {
  cancelEvent,
  createEvent,
  eventInputSchema,
  getEvent,
  getEventAttendees,
  leaveEvent,
  listUpcomingEvents,
  rsvpEvent,
} from "./events";
import {
  claimOffer,
  listActiveOffers,
  listMyCoupons,
  createOffer,
  listOfferCoupons,
  offerInputSchema,
  redeemCoupon,
} from "./offers";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
const SEED_EVENT = "55555555-5555-4555-8555-555555555551";
const SEED_OFFER = "66666666-6666-4666-8666-666666666661";
const SEED_BUSINESS = "33333333-3333-4333-8333-333333333331";

function newClient() {
  return createClient<Database>(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
async function signIn(email: string) {
  const client = newClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password: "Gearhead123" });
  if (error) throw error;
  return { client: client as GearheadClient, userId: data.user.id };
}

describe.skipIf(!url || !key)("eventos e ofertas — integração com Supabase local", () => {
  let organizer: Awaited<ReturnType<typeof signIn>>; // piloto: organiza o evento e é dono da oferta
  let guest: Awaited<ReturnType<typeof signIn>>; // admin do seed, aqui como participante/cliente
  const anon = url && key ? newClient() : (null as unknown as GearheadClient);
  let createdEventId = "";
  let testOfferId = "";

  beforeAll(async () => {
    organizer = await signIn("piloto@gearhead.test");
    guest = await signIn("admin@gearhead.test");
  });

  afterAll(async () => {
    await leaveEvent(guest.client, SEED_EVENT, guest.userId);
    if (createdEventId) await cancelEvent(organizer.client, createdEventId, "limpeza de teste");
    if (testOfferId) {
      // Encerra a oferta de teste (sai da contagem de vigentes e da vitrine).
      const { data } = await organizer.client
        .from("offers")
        .select("starts_at")
        .eq("id", testOfferId)
        .single();
      await organizer.client
        .from("offers")
        .update({
          status: "paused",
          ends_at: new Date(new Date(data!.starts_at).getTime() + 1000).toISOString(),
        })
        .eq("id", testOfferId);
    }
  });

  it("lista o evento do seed para o público", async () => {
    const { items } = await listUpcomingEvents(anon, { state: "PR" });
    expect(items.map((e) => e.id)).toContain(SEED_EVENT);
  });

  it("participante confirma presença; organizador vê o nome, anônimo não vê a lista", async () => {
    const before = (await getEvent(anon, SEED_EVENT))!.attendee_count;
    const total = await rsvpEvent(guest.client, SEED_EVENT);
    expect(total).toBe(before + 1);
    // O convidado do seed é admin (pode ver); anônimo não tem acesso à RPC.
    await expect(getEventAttendees(anon, SEED_EVENT)).rejects.toMatchObject({ code: "42501" });
    const list = await getEventAttendees(organizer.client, SEED_EVENT);
    expect(list.map((a) => a.username)).toContain("admin_gearhead");
    await leaveEvent(guest.client, SEED_EVENT, guest.userId);
    expect((await getEvent(anon, SEED_EVENT))!.attendee_count).toBe(before);
  });

  it("organizador cria e cancela evento; cancelado não aceita presença", async () => {
    const start = new Date(Date.now() + 3 * 86_400_000);
    createdEventId = await createEvent(
      organizer.client,
      eventInputSchema().parse({
        kind: "workshop",
        title: "Palestra de teste",
        startsAt: start.toISOString(),
        endsAt: new Date(start.getTime() + 2 * 3600_000).toISOString(),
        venueName: "Auditório",
        city: "Curitiba",
        state: "PR",
      }),
    );
    await cancelEvent(organizer.client, createdEventId, "Teste");
    await expect(rsvpEvent(guest.client, createdEventId)).rejects.toMatchObject({ code: "GH001" });
    createdEventId = "";
  });

  it("cliente pega cupom, parceiro resgata uma vez só", async () => {
    expect((await listActiveOffers(anon)).map((o) => o.id)).toContain(SEED_OFFER);
    const endsOn = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    testOfferId = await createOffer(
      organizer.client,
      SEED_BUSINESS,
      offerInputSchema().parse({ title: "Oferta de teste", discountLabel: "15% OFF", endsOn }),
    );
    const coupon = await claimOffer(guest.client, testOfferId);
    expect(coupon.code).toMatch(/^[A-HJ-KM-NP-Z2-9]{8}$/);
    await expect(claimOffer(guest.client, testOfferId)).rejects.toMatchObject({ code: "GH001" });
    const mine = await listMyCoupons(guest.client, guest.userId);
    expect(mine.find((c) => c.code === coupon.code)?.offer?.business?.name).toBe(
      "Oficina Exemplo Turbo",
    );

    await expect(redeemCoupon(guest.client, coupon.code)).rejects.toMatchObject({ code: "P0002" });
    const redeemed = await redeemCoupon(
      organizer.client,
      `${coupon.code.slice(0, 4)}-${coupon.code.slice(4)}`,
    );
    expect(redeemed.discount_label).toBe("15% OFF");
    await expect(redeemCoupon(organizer.client, coupon.code)).rejects.toMatchObject({
      code: "GH001",
    });

    const partnerView = await listOfferCoupons(organizer.client, testOfferId);
    expect(partnerView.find((c) => c.code === coupon.code)?.status).toBe("redeemed");
    await expect(listOfferCoupons(anon, testOfferId)).rejects.toMatchObject({ code: "42501" });
  });
});
