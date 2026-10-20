"use server";

import {
  cancelCoupon,
  claimOffer,
  createOffer,
  dataErrorMessage,
  deleteOffer,
  formatCouponCode,
  offerInputSchema,
  redeemCoupon,
  setOfferStatus,
  type OfferStatus,
} from "@gearhead/shared";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

// Emissão, resgate e limites de cupons são validados no banco (RPCs com bloqueio).

function revalidateOffers(businessId?: string) {
  revalidatePath("/ofertas");
  revalidatePath("/meus-cupons");
  if (businessId) revalidatePath(`/meus-parceiros/${businessId}`);
}

export async function createOfferAction(
  businessId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const values = formValues(formData);
  const parsed = offerInputSchema().safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };
  try {
    await createOffer(await createClient(), businessId, parsed.data);
  } catch (e) {
    return { error: dataErrorMessage(e), values };
  }
  revalidateOffers(businessId);
  return { success: "Oferta publicada." };
}

export async function setOfferStatusAction(
  businessId: string,
  offerId: string,
  status: OfferStatus,
) {
  await requireUser();
  await setOfferStatus(await createClient(), offerId, status);
  revalidateOffers(businessId);
}

export async function deleteOfferAction(businessId: string, offerId: string): Promise<FormState> {
  await requireUser();
  try {
    await deleteOffer(await createClient(), offerId);
  } catch (e) {
    return { error: dataErrorMessage(e) };
  }
  revalidateOffers(businessId);
  return {};
}

export type ClaimState = FormState & { code?: string; expiresAt?: string };

export async function claimOfferAction(offerId: string): Promise<ClaimState> {
  await requireUser();
  try {
    const coupon = await claimOffer(await createClient(), offerId);
    revalidateOffers();
    return { success: "Cupom gerado!", code: coupon.code, expiresAt: coupon.expires_at };
  } catch (e) {
    return { error: dataErrorMessage(e) };
  }
}

export async function cancelCouponAction(couponId: string) {
  await requireUser();
  await cancelCoupon(await createClient(), couponId);
  revalidateOffers();
}

export async function redeemCouponAction(
  businessId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { fieldErrors: { code: ["Digite o código do cupom."] } };
  try {
    const r = await redeemCoupon(await createClient(), code);
    revalidateOffers(businessId);
    return {
      success: `Cupom ${formatCouponCode(code.toUpperCase().replace(/[^A-Z0-9]/g, ""))} validado: ${r.discount_label} — ${r.offer_title}.`,
    };
  } catch (e) {
    return { error: dataErrorMessage(e), values: { code } };
  }
}
