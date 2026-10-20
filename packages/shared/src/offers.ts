import { z } from "zod";
import { fail, GearheadDataError, type GearheadClient } from "./data-core";

/** Ofertas e cupons simples (sem carteira financeira). Regras no banco. */

export type OfferStatus = "active" | "paused";
export type CouponStatus = "issued" | "redeemed" | "cancelled";

export const COUPON_STATUS_LABELS: Record<CouponStatus | "expired", string> = {
  issued: "Disponível",
  redeemed: "Utilizado",
  cancelled: "Cancelado",
  expired: "Vencido",
};

export interface Offer {
  id: string;
  business_id: string;
  title: string;
  description: string | null;
  discount_label: string;
  terms: string | null;
  starts_at: string;
  ends_at: string;
  max_redemptions: number | null;
  per_user_limit: number;
  issued_count: number;
  status: OfferStatus;
  business: { id: string; name: string; city: string; state: string } | null;
}

export interface Coupon {
  id: string;
  offer_id: string;
  user_id: string;
  code: string;
  status: CouponStatus;
  issued_at: string;
  redeemed_at: string | null;
  expires_at: string;
  offer: { title: string; discount_label: string; business: { name: string } | null } | null;
}

const OFFER_COLUMNS =
  "id, business_id, title, description, discount_label, terms, starts_at, ends_at, max_redemptions, per_user_limit, issued_count, status, business:businesses(id, name, city, state)";

const COUPON_COLUMNS =
  "id, offer_id, user_id, code, status, issued_at, redeemed_at, expires_at, offer:offers(title, discount_label, business:businesses(name))";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .nullish()
    .transform((v) => (v ? v : null));

const optionalInt = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number().int("Número inteiro").min(min, `Mínimo ${min}`).max(max, `Máximo ${max}`).nullable(),
  );

/** Data "AAAA-MM-DD": a oferta vale até 23:59 desse dia (Brasília). */
const endDate = z
  .string("Informe a data final")
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
  .transform((v) => new Date(`${v}T23:59:59-03:00`));

export function offerInputSchema(now: Date = new Date()) {
  return z
    .object({
      title: z
        .string()
        .trim()
        .min(3, "Mínimo de 3 caracteres")
        .max(120, "Máximo de 120 caracteres"),
      discountLabel: z.string().trim().min(2, "Ex.: 10% OFF").max(60, "Máximo de 60 caracteres"),
      description: optionalText(1000),
      terms: optionalText(1000),
      endsOn: endDate,
      maxRedemptions: optionalInt(1, 100000),
      perUserLimit: z.preprocess(
        (v) => (v === "" || v === null || v === undefined ? 1 : Number(v)),
        z.number().int().min(1, "Mínimo 1").max(10, "Máximo 10"),
      ),
    })
    .refine((o) => o.endsOn > now, { message: "A data final precisa ser futura", path: ["endsOn"] })
    .refine((o) => o.endsOn.getTime() - now.getTime() <= 365 * 86_400_000, {
      message: "Validade máxima de 1 ano",
      path: ["endsOn"],
    });
}
export type OfferInput = z.infer<ReturnType<typeof offerInputSchema>>;

function toOfferRow(input: OfferInput) {
  return {
    title: input.title,
    discount_label: input.discountLabel,
    description: input.description,
    terms: input.terms,
    ends_at: input.endsOn.toISOString(),
    max_redemptions: input.maxRedemptions,
    per_user_limit: input.perUserLimit,
  };
}

/** Ofertas vigentes de parceiros aprovados (a RLS garante), mais próximas do fim primeiro. */
export async function listActiveOffers(client: GearheadClient, limit = 50): Promise<Offer[]> {
  const { data, error } = await client
    .from("offers")
    .select(OFFER_COLUMNS)
    .eq("status", "active")
    .gt("ends_at", new Date().toISOString())
    .order("ends_at")
    .limit(limit)
    .overrideTypes<Offer[], { merge: false }>();
  if (error) fail(error);
  return data;
}

export async function listBusinessOffers(
  client: GearheadClient,
  businessId: string,
): Promise<Offer[]> {
  const { data, error } = await client
    .from("offers")
    .select(OFFER_COLUMNS)
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(50)
    .overrideTypes<Offer[], { merge: false }>();
  if (error) fail(error);
  return data;
}

export async function getOffer(client: GearheadClient, id: string): Promise<Offer | null> {
  const { data, error } = await client
    .from("offers")
    .select(OFFER_COLUMNS)
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<Offer | null, { merge: false }>();
  if (error) {
    if (error.code === "22P02") return null;
    fail(error);
  }
  return data;
}

export async function createOffer(client: GearheadClient, businessId: string, input: OfferInput) {
  const { data, error } = await client
    .from("offers")
    .insert({ business_id: businessId, ...toOfferRow(input) })
    .select("id")
    .single();
  if (error) fail(error);
  return data.id;
}

export async function setOfferStatus(client: GearheadClient, offerId: string, status: OfferStatus) {
  const { data, error } = await client
    .from("offers")
    .update({ status })
    .eq("id", offerId)
    .select("id");
  if (error) fail(error);
  if (data.length === 0) throw new GearheadDataError("not_found", "Oferta não encontrada.");
}

export async function deleteOffer(client: GearheadClient, offerId: string) {
  const { data, error } = await client.from("offers").delete().eq("id", offerId).select("id");
  if (error) fail(error);
  if (data.length === 0) throw new GearheadDataError("not_found", "Oferta não encontrada.");
}

export async function claimOffer(client: GearheadClient, offerId: string) {
  const { data, error } = await client.rpc("claim_offer", { p_offer_id: offerId });
  if (error) fail(error);
  const row = data[0];
  if (!row) throw new GearheadDataError("not_found", "Não foi possível emitir o cupom.");
  return row;
}

export async function cancelCoupon(client: GearheadClient, couponId: string) {
  const { error } = await client.rpc("cancel_coupon", { p_coupon_id: couponId });
  if (error) fail(error);
}

export async function redeemCoupon(client: GearheadClient, code: string) {
  const { data, error } = await client.rpc("redeem_coupon", { p_code: code });
  if (error) fail(error);
  const row = data[0];
  if (!row) throw new GearheadDataError("not_found", "Cupom não encontrado.");
  return row;
}

export async function listMyCoupons(client: GearheadClient, userId: string): Promise<Coupon[]> {
  const { data, error } = await client
    .from("coupons")
    .select(COUPON_COLUMNS)
    .eq("user_id", userId)
    .order("issued_at", { ascending: false })
    .limit(100)
    .overrideTypes<Coupon[], { merge: false }>();
  if (error) fail(error);
  return data;
}

/** Cupons emitidos para uma oferta (dono do parceiro — RLS). */
export async function listOfferCoupons(client: GearheadClient, offerId: string): Promise<Coupon[]> {
  const { data, error } = await client
    .from("coupons")
    .select(COUPON_COLUMNS)
    .eq("offer_id", offerId)
    .order("issued_at", { ascending: false })
    .limit(500)
    .overrideTypes<Coupon[], { merge: false }>();
  if (error) fail(error);
  return data;
}

/** Status efetivo: cupom emitido e vencido aparece como "expired". */
export function effectiveCouponStatus(
  c: Pick<Coupon, "status" | "expires_at">,
  now: Date = new Date(),
): CouponStatus | "expired" {
  return c.status === "issued" && new Date(c.expires_at) <= now ? "expired" : c.status;
}

/** "ABCD2345" → "ABCD-2345" para leitura no balcão. */
export function formatCouponCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

export function offerRemaining(o: Pick<Offer, "max_redemptions" | "issued_count">): number | null {
  return o.max_redemptions === null ? null : Math.max(o.max_redemptions - o.issued_count, 0);
}
