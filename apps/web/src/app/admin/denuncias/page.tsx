import {
  adminListReports,
  REPORT_REASON_LABELS,
  REPORT_TARGET_LABELS,
  reportTargetPath,
} from "@gearhead/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { hideVehicleAction, resolveReportAction } from "@/app/actions/community";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ReviewForm, type Decision } from "../review-form";

export const metadata: Metadata = { title: "Denúncias — Gearhead", robots: { index: false } };

const DECISIONS: Decision[] = [
  { value: "resolved", label: "Resolvida", pendingLabel: "Salvando…", variant: "primary" },
  {
    value: "dismissed",
    label: "Arquivar (improcedente)",
    pendingLabel: "Salvando…",
    variant: "secondary",
  },
];
const HIDE: Decision[] = [
  { value: "hide", label: "Ocultar veículo", pendingLabel: "Ocultando…", variant: "danger" },
];

export default function ReportsPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-12">
      <Link href="/admin" className="text-sm text-muted hover:underline">
        ← Administração
      </Link>
      <h1 className="text-3xl font-bold tracking-tight">Denúncias abertas</h1>
      <Suspense fallback={<p className="text-muted">Carregando…</p>}>
        <Queue />
      </Suspense>
    </main>
  );
}

async function Queue() {
  await requireAdmin();
  const reports = await adminListReports(await createClient(), "open");
  if (reports.length === 0) return <p className="text-muted">Nenhuma denúncia aberta. 🎉</p>;
  return (
    <ul className="flex flex-col gap-4">
      {reports.map((r) => {
        const path = reportTargetPath(r.target_type, r.target_id);
        return (
          <li
            key={r.id}
            className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold">
                {REPORT_TARGET_LABELS[r.target_type]} · {REPORT_REASON_LABELS[r.reason]}
              </p>
              <p className="text-xs text-muted">
                {new Date(r.created_at).toLocaleString("pt-BR")} · por @{r.reporter_username ?? "?"}
                {r.same_target_open > 1 &&
                  ` · ${r.same_target_open} denúncias abertas para este alvo`}
              </p>
            </div>
            {r.details && <p className="text-sm">{r.details}</p>}
            {path ? (
              <Link
                href={path}
                className="self-start text-sm text-accent hover:underline"
                target="_blank"
              >
                Abrir conteúdo denunciado →
              </Link>
            ) : (
              <p className="text-xs text-muted">Perfil sem nome de usuário (id {r.target_id}).</p>
            )}
            {r.target_type === "vehicle" && (
              <ReviewForm
                action={hideVehicleAction.bind(null, r.target_id)}
                decisions={HIDE}
                noteLabel="Motivo da ocultação (auditado)"
              />
            )}
            <ReviewForm
              action={resolveReportAction.bind(null, r.id)}
              decisions={DECISIONS}
              noteLabel="Nota da decisão (opcional)"
            />
          </li>
        );
      })}
    </ul>
  );
}
