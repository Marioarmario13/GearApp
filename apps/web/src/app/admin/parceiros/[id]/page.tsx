import {
  BUSINESS_KIND_LABELS,
  CREDENTIAL_TYPE_LABELS,
  formatPhone,
  getBusiness,
  getBusinessReview,
  getPrivateCredentials,
  isExpired,
  listAuditLog,
  signDocumentUrls,
} from "@gearhead/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { reviewBusinessAction, reviewCredentialAction } from "@/app/actions/partners";
import { BusinessStatusBadge, CredentialStatusBadge } from "@/components/partners";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ReviewForm, type Decision } from "../../review-form";

export const metadata: Metadata = { title: "Conferência — Gearhead", robots: { index: false } };

const ACTION_LABELS: Record<string, string> = {
  "business.approved": "Parceiro aprovado",
  "business.rejected": "Parceiro recusado",
  "business.suspended": "Parceiro suspenso",
  "business.pending": "Voltou para conferência",
  "business.resubmitted": "Dono alterou nome/tipo",
  "credential.approved": "Documento conferido",
  "credential.rejected": "Documento recusado",
};

const CREDENTIAL_DECISIONS: Decision[] = [
  { value: "approved", label: "Conferido", pendingLabel: "Salvando…", variant: "primary" },
  { value: "rejected", label: "Recusar", pendingLabel: "Salvando…", variant: "danger" },
];

export default function AdminPartnerPage({ params }: PageProps<"/admin/parceiros/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-12">
      <Link href="/admin" className="text-sm text-muted hover:underline">
        ← Fila de conferência
      </Link>
      <Suspense fallback={<p className="text-muted">Carregando…</p>}>
        <Review params={params} />
      </Suspense>
    </main>
  );
}

async function Review({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();
  const supabase = await createClient();
  const business = await getBusiness(supabase, id);
  if (!business) notFound();

  const [review, credentials] = await Promise.all([
    getBusinessReview(supabase, id),
    getPrivateCredentials(supabase, id),
  ]);
  const [urls, audit] = await Promise.all([
    signDocumentUrls(
      supabase,
      credentials.map((c) => c.document_path),
    ),
    listAuditLog(supabase, [id, ...credentials.map((c) => c.id)]),
  ]);
  const hasApprovedRegistration = credentials.some(
    (c) => c.type === "business_registration" && c.status === "approved",
  );

  const businessDecisions: Decision[] = [
    ...(business.status !== "approved"
      ? [
          {
            value: "approved",
            label: "Aprovar parceiro",
            pendingLabel: "Aprovando…",
            variant: "primary" as const,
          },
        ]
      : []),
    ...(business.status === "pending"
      ? [
          {
            value: "rejected",
            label: "Recusar",
            pendingLabel: "Recusando…",
            variant: "danger" as const,
          },
        ]
      : []),
    ...(business.status === "approved"
      ? [
          {
            value: "suspended",
            label: "Suspender",
            pendingLabel: "Suspendendo…",
            variant: "danger" as const,
          },
        ]
      : []),
  ];

  return (
    <>
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{business.name}</h1>
          <BusinessStatusBadge status={business.status} />
        </div>
        <p className="text-muted">
          {BUSINESS_KIND_LABELS[business.kind]} · {business.city}/{business.state}
          {business.phone ? ` · ${formatPhone(business.phone)}` : ""}
          {business.email ? ` · ${business.email}` : ""}
        </p>
        {review?.review_note && <p className="text-sm">Última observação: {review.review_note}</p>}
      </header>

      <section aria-labelledby="docs" className="flex flex-col gap-4">
        <h2 id="docs" className="text-xl font-semibold">
          1. Conferir documentos
        </h2>
        {credentials.length === 0 ? (
          <p className="text-muted">Nenhum documento enviado.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {credentials.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{c.title}</p>
                  <CredentialStatusBadge status={c.status} />
                </div>
                <p className="text-sm text-muted">
                  {CREDENTIAL_TYPE_LABELS[c.type]}
                  {c.issuer ? ` · ${c.issuer}` : ""}
                  {c.issued_on ? ` · emissão ${c.issued_on}` : ""}
                  {c.expires_on
                    ? ` · validade ${c.expires_on}${isExpired(c.expires_on) ? " (VENCIDO)" : ""}`
                    : ""}
                </p>
                {urls[c.document_path] ? (
                  <a
                    href={urls[c.document_path]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-accent hover:underline"
                  >
                    Abrir documento (link válido por 5 min)
                  </a>
                ) : (
                  <p className="text-sm text-red-600">
                    Arquivo indisponível — não aprove sem ver o documento.
                  </p>
                )}
                {c.review_note && <p className="text-sm">Observação: {c.review_note}</p>}
                {c.status === "pending" && (
                  <ReviewForm
                    action={reviewCredentialAction.bind(null, business.id, c.id)}
                    decisions={CREDENTIAL_DECISIONS}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="decisao"
        className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5"
      >
        <h2 id="decisao" className="text-xl font-semibold">
          2. Decisão sobre o parceiro
        </h2>
        {!hasApprovedRegistration && business.status !== "approved" && (
          <p className="text-sm text-muted">
            A aprovação exige um documento de registro (CNPJ/MEI) conferido no passo 1.
          </p>
        )}
        <ReviewForm
          action={reviewBusinessAction.bind(null, business.id)}
          decisions={businessDecisions}
          noteLabel="Observação para o dono (obrigatória para recusar ou suspender)"
        />
      </section>

      <section aria-labelledby="historico" className="flex flex-col gap-2">
        <h2 id="historico" className="text-xl font-semibold">
          Histórico (auditoria)
        </h2>
        {audit.length === 0 ? (
          <p className="text-sm text-muted">Sem registros.</p>
        ) : (
          <ol className="flex flex-col gap-1 text-sm">
            {audit.map((a) => (
              <li key={a.id}>
                <time dateTime={a.created_at} className="text-muted">
                  {new Date(a.created_at).toLocaleString("pt-BR")}
                </time>{" "}
                — {ACTION_LABELS[a.action] ?? a.action}
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
