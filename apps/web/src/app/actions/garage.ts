"use server";

import {
  createVehicle,
  dataErrorMessage,
  deleteVehicle,
  deleteVehiclePhoto,
  getVehicle,
  updateVehicle,
  uploadVehiclePhoto,
  validatePhoto,
  vehicleInputSchema,
} from "@gearhead/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/forms";
import { InvalidImageError, sanitizePhoto } from "@/lib/images";
import { createClient } from "@/lib/supabase/server";

// Toda action revalida a sessão; a autorização efetiva é do banco (RLS/Storage).

export async function createVehicleAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const values = formValues(formData);
  const parsed = vehicleInputSchema().safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };

  let id: string;
  try {
    id = await createVehicle(await createClient(), parsed.data);
  } catch (e) {
    return { error: dataErrorMessage(e), values };
  }
  revalidatePath("/garagem");
  redirect(`/garagem/${id}`);
}

export async function updateVehicleAction(
  vehicleId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const values = formValues(formData);
  const parsed = vehicleInputSchema().safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };

  try {
    await updateVehicle(await createClient(), vehicleId, parsed.data);
  } catch (e) {
    return { error: dataErrorMessage(e), values };
  }
  revalidatePath("/garagem");
  revalidatePath(`/garagem/${vehicleId}`);
  return { success: "Veículo atualizado.", values };
}

export async function deleteVehicleAction(vehicleId: string): Promise<FormState> {
  await requireUser();
  try {
    await deleteVehicle(await createClient(), vehicleId);
  } catch (e) {
    return { error: dataErrorMessage(e) };
  }
  revalidatePath("/garagem");
  redirect("/garagem");
}

export async function uploadPhotoAction(
  vehicleId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecione uma foto." };
  const problem = validatePhoto(file);
  if (problem) return { error: problem };

  const supabase = await createClient();
  try {
    const vehicle = await getVehicle(supabase, vehicleId);
    if (!vehicle || vehicle.owner_id !== user.id) return { error: "Veículo não encontrado." };
    // Remove EXIF/GPS e limita o tamanho antes de gravar (fotos podem ficar públicas).
    const clean = await sanitizePhoto(await file.arrayBuffer(), file.type);
    await uploadVehiclePhoto(supabase, { ownerId: user.id, vehicle, ...clean });
  } catch (e) {
    return { error: e instanceof InvalidImageError ? e.message : dataErrorMessage(e) };
  }
  revalidatePath(`/garagem/${vehicleId}`);
  revalidatePath("/garagem");
  return { success: "Foto enviada." };
}

export async function deletePhotoAction(vehicleId: string, photoId: string): Promise<void> {
  await requireUser();
  const supabase = await createClient();
  const vehicle = await getVehicle(supabase, vehicleId);
  const photo = vehicle?.photos.find((p) => p.id === photoId);
  if (photo) await deleteVehiclePhoto(supabase, photo);
  revalidatePath(`/garagem/${vehicleId}`);
  revalidatePath("/garagem");
}
