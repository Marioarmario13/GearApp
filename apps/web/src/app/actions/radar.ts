"use server";

import {
  BUSINESS_KINDS,
  businessLocationSchema,
  dataErrorMessage,
  MAX_RADIUS_KM,
  searchNearby,
  setBusinessLocation,
  type RadarResult,
} from "@gearhead/shared";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import type { FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

const searchSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusKm: z.number().min(1).max(MAX_RADIUS_KM),
  kind: z.enum(BUSINESS_KINDS).nullable(),
  specialty: z
    .string()
    .regex(/^[a-z0-9-]{1,40}$/)
    .nullable(),
});

export type RadarSearchResult = { results: RadarResult[] } | { error: string };

/**
 * Busca pública por raio. A posição chega já arredondada pelo cliente (~1 km),
 * é usada só nesta consulta e não é gravada.
 */
export async function searchRadarAction(input: unknown): Promise<RadarSearchResult> {
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) return { error: "Parâmetros de busca inválidos." };
  try {
    const results = await searchNearby(await createClient(), parsed.data);
    return { results };
  } catch (e) {
    return { error: dataErrorMessage(e) };
  }
}

export async function setBusinessLocationAction(
  businessId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const supabase = await createClient();

  try {
    if (formData.get("intent") === "clear") {
      await setBusinessLocation(supabase, businessId, null);
    } else {
      const parsed = businessLocationSchema.safeParse({
        latitude: formData.get("latitude"),
        longitude: formData.get("longitude"),
      });
      if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? "Escolha um ponto no mapa." };
      }
      await setBusinessLocation(supabase, businessId, parsed.data);
    }
  } catch (e) {
    return { error: dataErrorMessage(e) };
  }
  revalidatePath(`/meus-parceiros/${businessId}`);
  revalidatePath(`/parceiros/${businessId}`);
  return {
    success: formData.get("intent") === "clear" ? "Localização removida." : "Localização salva.",
  };
}
