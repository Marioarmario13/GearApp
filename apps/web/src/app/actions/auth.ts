"use server";

import {
  authErrorMessage,
  profileUpdateSchema,
  signInSchema,
  signUpSchema,
  toProfileRow,
} from "@gearhead/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { fieldErrorsFrom, formValues, safeNextPath, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };

  const { email, password, username, displayName } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username, display_name: displayName } },
  });
  if (error) return { error: authErrorMessage(error), values };

  // Com confirmação de e-mail ativa não há sessão ainda.
  if (!data.session) {
    return { success: "Conta criada! Confira seu e-mail para confirmar o cadastro." };
  }
  redirect("/conta");
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authErrorMessage(error), values };

  redirect(safeNextPath(formData.get("next")));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  // Re-verifica a sessão dentro da action: nunca confiar só na página que exibiu o form.
  const user = await requireUser();
  const values = formValues(formData);
  const parsed = profileUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update(toProfileRow(parsed.data))
    .eq("id", user.id);
  if (error) return { error: authErrorMessage({ code: error.code }), values };

  revalidatePath("/conta");
  return { success: "Perfil atualizado.", values };
}
