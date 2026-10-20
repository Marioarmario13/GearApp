import {
  BUSINESS_STATUS_LABELS,
  CREDENTIAL_TYPE_LABELS,
  getBusiness,
  getBusinessReview,
  getPrivateCredentials,
  isExpired,
  listSpecialties,
  signDocumentUrls,
} from "@gearhead/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  deleteBusinessAction,
  deleteCredentialAction,
  updateBusinessAction,
  uploadCredentialAction,
} from "@/app/actions/partners";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { BusinessStatusBadge, CredentialStatusBadge } from "@/components/partners";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BusinessForm } from "../business-form";
import { setBusinessLocationAction } from "@/app/actions/radar";
import { CredentialUploader } from "./credential-uploader";
import { LocationPicker } from "./location-picker";

export const metadata: Metadata = { title: "Estabelecimento — Gearhead" };

export default function MyBusinessPage({ params }: PageProps<"/meus-parceiros/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-12">
      <Link href="/meus-parceiros" className="text-sm text-muted hover:underline">
        ← Meus estabelecimentos
      </Link>
      <Suspense fallback={<p className="text-muted">Carregando…</p>}>
        <MyBusiness params={params} />
      </Suspense>
    </main>
  );
}

const STATUS_HELP = {
  pending:
    "Aguardando conferência. Envie o documento de registro (CNPJ ou MEI) se ainda não enviou.",
  approved: "Seu estabelecimento está no diretório com o selo de verificado.",
  rejected: "O cadastro foi recusado. Veja o motivo, ajuste e envie novos documentos.",
  suspended: "O cadastro está suspenso e fora do diretório. Veja o motivo abaixo.",
} as const;

async function MyBusiness({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();
  const business = await getBusiness(supabase, id);
  if (!business || business.owner_id !== user.id) notFound();

  const [review, credentials, specialties] = await Promise.all([
    getBusinessReview(supabase, id),
    getPrivateCredentials(supabase, id),
    listSpecialties(supabase),
  ]);
  const urls = await signDocumentUrls(
    supabase,
    credentials.map((c) => c.document_path),
  );
  const hasRegistration = credentials.some(
    (c) => c.type === "business_registration" && c.status !== "rejected",
  );

  return (
    <>
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{business.name}</h1>
          <BusinessStatusBadge status={business.status} />
        </div>
        {business.status === "approved" && (
          <Link href={`/parceiros/${business.id}`} className="text-sm text-accent hover:underline">
            Ver página pública →
          </Link>
        )}
      </header>

      <section
        aria-label="Situação da conferência"
        className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-5"
      >
        <p className="font-semibold">{BUSINESS_STATUS_LABELS[business.status]}</p>
        <p className="text-sm text-muted">{STATUS_HELP[business.status]}</p>
        {review?.review_note && (
          <p className="mt-2 text-sm">
            <span className="font-medium">Observação da equipe:</span> {review.review_note}
          </p>
        )}
      </section>

      <section aria-labelledby="docs" className="flex flex-col gap-4">
        <h2 id="docs" className="text-xl font-semibold">
          Documentos ({credentials.length})
        </h2>
        {credentials.length === 0 ? (
          <p className="text-muted">Nenhum documento enviado ainda.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {credentials.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{c.title}</p>
                  <CredentialStatusBadge status={c.status} />
                </div>
                <p className="text-sm text-muted">
                  {CREDENTIAL_TYPE_LABELS[c.type]}
                  {c.issuer ? ` · ${c.issuer}` : ""}
                  {c.expires_on
                    ? ` · validade ${new Date(`${c.expires_on}T12:00:00`).toLocaleDateString("pt-BR")}${isExpired(c.expires_on) ? " (vencido)" : ""}`
                    : ""}
                </p>
                {c.review_note && (
                  <p className="text-sm">
                    <span className="font-medium">Observação:</span> {c.review_note}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  {urls[c.document_path] && (
                    <a
                      href={urls[c.document_path]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      Abrir arquivo
                    </a>
                  )}
                  <form action={deleteCredentialAction.bind(null, business.id, c.id)}>
                    <button
                      type="submit"
                      className="text-red-600 hover:underline dark:text-red-400"
                    >
                      Remover
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
        <CredentialUploader
          action={uploadCredentialAction.bind(null, business.id)}
          specialties={specialties}
          hasRegistration={hasRegistration}
        />
      </section>

      <section aria-labelledby="mapa" className="rounded-2xl border border-line bg-surface p-6">
        <h2 id="mapa" className="mb-4 text-xl font-semibold">
          Localização no mapa
        </h2>
        <LocationPicker
          action={setBusinessLocationAction.bind(null, business.id)}
          initial={
            business.latitude !== null && business.longitude !== null
              ? { latitude: business.latitude, longitude: business.longitude }
              : null
          }
        />
      </section>

      <section className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="mb-4 text-xl font-semibold">Dados do estabelecimento</h2>
        <BusinessForm
          action={updateBusinessAction.bind(null, business.id)}
          business={business}
          specialties={specialties}
          submitLabel="Salvar alterações"
        />
      </section>

      <section className="rounded-2xl border border-red-300 p-6 dark:border-red-900">
        <h2 className="text-xl font-semibold">Excluir estabelecimento</h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          Remove o cadastro, as especialidades e os documentos. Não pode ser desfeito.
        </p>
        <ConfirmActionButton
          action={deleteBusinessAction.bind(null, business.id)}
          confirmText="Excluir este estabelecimento e todos os documentos?"
          label="Excluir estabelecimento"
          pendingLabel="Excluindo…"
        />
      </section>
    </>
  );
}
