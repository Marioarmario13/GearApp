"use server";

import {
  businessLocationSchema,
  cancelEvent,
  createEvent,
  dataErrorMessage,
  eventInputSchema,
  leaveEvent,
  removeEvent,
  rsvpEvent,
  setEventLocation,
  updateEvent,
} from "@gearhead/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireUser } from "@/lib/auth";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

// Toda action revalida a sessão; a autorização efetiva é do banco (RLS e RPCs).

function revalidateEvent(id?: string) {
  revalidatePath("/eventos");
  revalidatePath("/eventos/meus");
  if (id) revalidatePath(`/eventos/${id}`);
}

export async function createEventAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const values = formValues(formData);
  const parsed = eventInputSchema().safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };
  let id: string;
  try {
    id = await createEvent(await createClient(), parsed.data);
  } catch (e) {
    return { error: dataErrorMessage(e), values };
  }
  revalidateEvent();
  redirect(`/eventos/${id}`);
}

export async function updateEventAction(
  eventId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const values = formValues(formData);
  const parsed = eventInputSchema().safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };
  try {
    await updateEvent(await createClient(), eventId, parsed.data);
  } catch (e) {
    return { error: dataErrorMessage(e), values };
  }
  revalidateEvent(eventId);
  return { success: "Evento atualizado.", values };
}

export async function rsvpAction(eventId: string): Promise<FormState> {
  await requireUser();
  try {
    await rsvpEvent(await createClient(), eventId);
  } catch (e) {
    return { error: dataErrorMessage(e) };
  }
  revalidateEvent(eventId);
  return { success: "Presença confirmada." };
}

export async function leaveEventAction(eventId: string): Promise<FormState> {
  const user = await requireUser();
  try {
    await leaveEvent(await createClient(), eventId, user.id);
  } catch (e) {
    return { error: dataErrorMessage(e) };
  }
  revalidateEvent(eventId);
  return { success: "Presença cancelada." };
}

export async function cancelEventAction(
  eventId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const note =
    String(formData.get("note") ?? "")
      .trim()
      .slice(0, 500) || null;
  try {
    await cancelEvent(await createClient(), eventId, note);
  } catch (e) {
    return { error: dataErrorMessage(e) };
  }
  revalidateEvent(eventId);
  return { success: "Evento cancelado. Os confirmados verão o aviso." };
}

export async function removeEventAction(
  eventId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  try {
    await removeEvent(await createClient(), eventId, String(formData.get("note") ?? ""));
  } catch (e) {
    return { error: dataErrorMessage(e) };
  }
  revalidateEvent(eventId);
  return { success: "Evento removido." };
}

export async function setEventLocationAction(
  eventId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const supabase = await createClient();
  try {
    if (formData.get("intent") === "clear") {
      await setEventLocation(supabase, eventId, null);
    } else {
      const parsed = businessLocationSchema.safeParse({
        latitude: formData.get("latitude"),
        longitude: formData.get("longitude"),
      });
      if (!parsed.success)
        return { error: parsed.error.issues[0]?.message ?? "Escolha um ponto no mapa." };
      await setEventLocation(supabase, eventId, parsed.data);
    }
  } catch (e) {
    return { error: dataErrorMessage(e) };
  }
  revalidateEvent(eventId);
  return {
    success: formData.get("intent") === "clear" ? "Localização removida." : "Localização salva.",
  };
}
