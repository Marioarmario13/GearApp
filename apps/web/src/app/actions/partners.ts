"use server";

import {
  businessInputSchema,
  createBusiness,
  credentialInputSchema,
  dataErrorMessage,
  deleteBusiness,
  deleteCredential,
  getBusiness,
  getPrivateCredentials,
  reviewBusiness,
  reviewCredential,
  reviewNoteSchema,
  updateBusiness,
  uploadCredential,
} from "@gearhead/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireUser } from "@/lib/auth";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

// Toda action revalida a sessão; a autorização efetiva é do banco (RLS, RPCs, Storage).

function businessFromForm(formData: FormData) {
  return {
    ...Object.fromEntries(formData),
    // Checkboxes repetidos: Object.fromEntries manteria só o último.
    specialties: formData.getAll("specialties").map(String),
  };
}

/** Valores para repreencher o formulário; especialidades vão separadas por vírgula. */
function businessValues(formData: FormData) {
  return { ...formValues(formData), specialties: formData.getAll("specialties").join(",") };
}

function revalidatePartner(id?: string) {
  revalidatePath("/parceiros");
  revalidatePath("/meus-parceiros");
  revalidatePath("/admin");
  if (id) {
    revalidatePath(`/parceiros/${id}`);
    revalidatePath(`/meus-parceiros/${id}`);
    revalidatePath(`/admin/parceiros/${id}`);
  }
}

export async function createBusinessAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const values = businessValues(formData);
  const parsed = businessInputSchema.safeParse(businessFromForm(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };

  let id: string;
  try {
    id = await createBusiness(await createClient(), parsed.data);
  } catch (e) {
    return { error: dataErrorMessage(e), values };
  }
  revalidatePartner();
  redirect(`/meus-parceiros/${id}`);
}

export async function updateBusinessAction(
  businessId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const values = businessValues(formData);
  const parsed = businessInputSchema.safeParse(businessFromForm(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };

  try {
    await updateBusiness(await createClient(), businessId, parsed.data);
  } catch (e) {
    return { error: dataErrorMessage(e), values };
  }
  revalidatePartner(businessId);
  return { success: "Dados salvos.", values };
}

export async function deleteBusinessAction(businessId: string): Promise<FormState> {
  await requireUser();
  try {
    await deleteBusiness(await createClient(), businessId);
  } catch (e) {
    return { error: dataErrorMessage(e) };
  }
  revalidatePartner(businessId);
  redirect("/meus-parceiros");
}

export async function uploadCredentialAction(
  businessId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const values = formValues(formData);
  const file = formData.get("document");
  if (!(file instanceof File) || file.size === 0) {
    return { fieldErrors: { document: ["Selecione o arquivo do documento."] }, values };
  }
  const parsed = credentialInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };

  try {
    await uploadCredential(await createClient(), {
      ownerId: user.id,
      businessId,
      input: parsed.data,
      body: file,
      contentType: file.type,
    });
  } catch (e) {
    return { error: dataErrorMessage(e), values };
  }
  revalidatePartner(businessId);
  return { success: "Documento enviado para conferência." };
}

export async function deleteCredentialAction(businessId: string, credentialId: string) {
  await requireUser();
  const supabase = await createClient();
  const credential = (await getPrivateCredentials(supabase, businessId)).find(
    (c) => c.id === credentialId,
  );
  if (credential) await deleteCredential(supabase, credential);
  revalidatePartner(businessId);
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function reviewCredentialAction(
  businessId: string,
  credentialId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const decision = formData.get("decision");
  if (decision !== "approved" && decision !== "rejected") return { error: "Decisão inválida." };
  const note = reviewNoteSchema.safeParse(formData.get("note"));
  if (!note.success) return { error: note.error.issues[0]?.message };

  try {
    await reviewCredential(await createClient(), credentialId, decision, note.data);
  } catch (e) {
    return { error: dataErrorMessage(e) };
  }
  revalidatePartner(businessId);
  return { success: decision === "approved" ? "Documento conferido." : "Documento recusado." };
}

export async function reviewBusinessAction(
  businessId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const decision = formData.get("decision");
  if (decision !== "approved" && decision !== "rejected" && decision !== "suspended") {
    return { error: "Decisão inválida." };
  }
  const note = reviewNoteSchema.safeParse(formData.get("note"));
  if (!note.success) return { error: note.error.issues[0]?.message };

  const supabase = await createClient();
  try {
    if (!(await getBusiness(supabase, businessId))) return { error: "Parceiro não encontrado." };
    await reviewBusiness(supabase, businessId, decision, note.data);
  } catch (e) {
    return { error: dataErrorMessage(e) };
  }
  revalidatePartner(businessId);
  const labels = {
    approved: "Parceiro aprovado.",
    rejected: "Parceiro recusado.",
    suspended: "Parceiro suspenso.",
  };
  return { success: labels[decision] };
}
