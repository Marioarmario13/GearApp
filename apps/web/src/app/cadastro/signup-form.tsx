"use client";

import { PASSWORD_MIN_LENGTH } from "@gearhead/shared";
import Link from "next/link";
import { useActionState } from "react";
import { signUp } from "@/app/actions/auth";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import type { FormState } from "@/lib/forms";

export function SignUpForm() {
  const [state, action] = useActionState<FormState, FormData>(signUp, {});
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage error={state.error} success={state.success} />
      <Field
        label="Nome"
        name="displayName"
        autoComplete="name"
        required
        defaultValue={v.displayName}
        errors={e.displayName}
      />
      <Field
        label="Nome de usuário"
        name="username"
        autoComplete="username"
        required
        defaultValue={v.username}
        errors={e.username}
        hint="3 a 30 caracteres: letras minúsculas, números ou _"
      />
      <Field
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={v.email}
        errors={e.email}
      />
      <Field
        label="Senha"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN_LENGTH}
        errors={e.password}
        hint={`Mínimo de ${PASSWORD_MIN_LENGTH} caracteres, com letras e números`}
      />
      <SubmitButton pendingText="Criando conta…">Criar conta</SubmitButton>
      <p className="text-sm text-muted">
        Já tem conta?{" "}
        <Link href="/entrar" className="font-medium text-accent underline-offset-4 hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
