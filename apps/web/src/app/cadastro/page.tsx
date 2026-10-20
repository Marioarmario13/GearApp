import type { Metadata } from "next";
import { AuthCard } from "@/components/auth-card";
import { SignUpForm } from "./signup-form";

export const metadata: Metadata = { title: "Criar conta — Gearhead" };

export default function SignUpPage() {
  return (
    <AuthCard
      title="Criar conta"
      subtitle="Monte sua garagem e encontre profissionais de confiança."
    >
      <SignUpForm />
    </AuthCard>
  );
}
