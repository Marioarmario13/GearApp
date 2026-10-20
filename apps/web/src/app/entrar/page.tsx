import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth-card";
import { SignInForm } from "./signin-form";

export const metadata: Metadata = { title: "Entrar — Gearhead" };

export default function SignInPage() {
  return (
    <AuthCard title="Entrar" subtitle="Bem-vindo de volta.">
      {/* useSearchParams lê a URL em tempo de requisição */}
      <Suspense fallback={<p className="text-muted">Carregando…</p>}>
        <SignInForm />
      </Suspense>
    </AuthCard>
  );
}
