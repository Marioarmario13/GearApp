"use server";

import {
  clearPresence,
  coarsenCoordinate,
  dataErrorMessage,
  listNearbyFriends,
  setPresence,
  shareInputSchema,
  startLocationSession,
  stopLocationSession,
  updateSessionLocation,
  type NearbyFriend,
} from "@gearhead/shared";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { fieldErrorsFrom, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

// Regras de privacidade (amizade, bloqueio, prazo, revogação, frequência) ficam no banco.

const position = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100000).nullable().optional(),
});

export async function startShareAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = shareInputSchema.safeParse({
    purpose: formData.get("purpose"),
    minutes: formData.get("minutes"),
    recipientIds: formData.getAll("recipientIds").map(String),
    note: formData.get("note"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };
  try {
    await startLocationSession(await createClient(), parsed.data);
  } catch (e) {
    return { error: dataErrorMessage(e) };
  }
  revalidatePath("/localizacao");
  return { success: "Compartilhamento iniciado. Envie sua posição." };
}

export async function updateShareAction(sessionId: string, input: unknown): Promise<FormState> {
  await requireUser();
  const parsed = position.safeParse(input);
  if (!parsed.success) return { error: "Posição inválida." };
  try {
    await updateSessionLocation(await createClient(), sessionId, parsed.data);
  } catch (e) {
    return { error: dataErrorMessage(e) };
  }
  return { success: "Posição enviada." };
}

export async function stopShareAction(sessionId: string): Promise<FormState> {
  await requireUser();
  try {
    await stopLocationSession(await createClient(), sessionId);
  } catch (e) {
    return { error: dataErrorMessage(e) };
  }
  revalidatePath("/localizacao");
  return { success: "Compartilhamento encerrado. Sua posição foi apagada." };
}

export async function setPresenceAction(input: unknown, minutes: number): Promise<FormState> {
  await requireUser();
  const parsed = position.safeParse(input);
  if (!parsed.success || ![30, 60, 120].includes(minutes)) return { error: "Dados inválidos." };
  try {
    // Já arredondada no aparelho; o banco ainda reduz para a célula de ~5,5 km.
    await setPresence(
      await createClient(),
      {
        latitude: coarsenCoordinate(parsed.data.latitude),
        longitude: coarsenCoordinate(parsed.data.longitude),
      },
      minutes,
    );
  } catch (e) {
    return { error: dataErrorMessage(e) };
  }
  return { success: `Você aparece para amigos por perto por ${minutes} min.` };
}

export async function clearPresenceAction(): Promise<FormState> {
  await requireUser();
  await clearPresence(await createClient());
  return { success: "Você não aparece mais para amigos por perto." };
}

export async function nearbyFriendsAction(
  input: unknown,
): Promise<{ friends?: NearbyFriend[]; error?: string }> {
  await requireUser();
  const parsed = position.safeParse(input);
  if (!parsed.success) return { error: "Posição inválida." };
  try {
    return {
      friends: await listNearbyFriends(await createClient(), {
        latitude: coarsenCoordinate(parsed.data.latitude),
        longitude: coarsenCoordinate(parsed.data.longitude),
      }),
    };
  } catch (e) {
    return { error: dataErrorMessage(e) };
  }
}
