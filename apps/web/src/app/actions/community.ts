"use server";

import {
  blockUser,
  dataErrorMessage,
  moderateHideVehicle,
  removeFriendship,
  reportInputSchema,
  resolveReport,
  respondFriendRequest,
  sendFriendRequest,
  submitReport,
  unblockUser,
} from "@gearhead/shared";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth";
import { fieldErrorsFrom, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

// Bloqueios e permissões são aplicados no banco; aqui só validamos entrada e sessão.

function revalidateCommunity(path?: string) {
  revalidatePath("/amigos");
  if (path) revalidatePath(path);
}

async function run(fn: () => Promise<unknown>, success: string, path?: string): Promise<FormState> {
  await requireUser();
  try {
    await fn();
  } catch (e) {
    return { error: dataErrorMessage(e) };
  }
  revalidateCommunity(path);
  return { success };
}

export async function sendFriendRequestAction(userId: string, path: string): Promise<FormState> {
  const supabase = await createClient();
  return run(() => sendFriendRequest(supabase, userId), "Pedido de amizade enviado.", path);
}

export async function respondFriendRequestAction(
  friendshipId: string,
  accept: boolean,
): Promise<FormState> {
  const supabase = await createClient();
  return run(
    () => respondFriendRequest(supabase, friendshipId, accept),
    accept ? "Amizade aceita." : "Pedido recusado.",
  );
}

export async function removeFriendshipAction(
  friendshipId: string,
  path?: string,
): Promise<FormState> {
  const supabase = await createClient();
  return run(() => removeFriendship(supabase, friendshipId), "Vínculo removido.", path);
}

export async function blockUserAction(userId: string, path: string): Promise<FormState> {
  const supabase = await createClient();
  return run(() => blockUser(supabase, userId), "Usuário bloqueado.", path);
}

export async function unblockUserAction(userId: string): Promise<FormState> {
  const supabase = await createClient();
  return run(() => unblockUser(supabase, userId), "Usuário desbloqueado.");
}

export async function reportAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = reportInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };
  try {
    await submitReport(await createClient(), parsed.data);
  } catch (e) {
    return { error: dataErrorMessage(e) };
  }
  revalidatePath("/admin/denuncias");
  return { success: "Denúncia enviada. Obrigado por ajudar a manter a comunidade segura." };
}

export async function resolveReportAction(
  reportId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const decision = formData.get("decision");
  if (decision !== "resolved" && decision !== "dismissed") return { error: "Decisão inválida." };
  const note =
    String(formData.get("note") ?? "")
      .trim()
      .slice(0, 500) || null;
  try {
    await resolveReport(await createClient(), reportId, decision, note);
  } catch (e) {
    return { error: dataErrorMessage(e) };
  }
  revalidatePath("/admin/denuncias");
  return { success: decision === "resolved" ? "Denúncia resolvida." : "Denúncia arquivada." };
}

export async function hideVehicleAction(
  vehicleId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  try {
    await moderateHideVehicle(await createClient(), vehicleId, String(formData.get("note") ?? ""));
  } catch (e) {
    return { error: dataErrorMessage(e) };
  }
  revalidatePath("/admin/denuncias");
  return { success: "Veículo ocultado (agora é privado)." };
}
