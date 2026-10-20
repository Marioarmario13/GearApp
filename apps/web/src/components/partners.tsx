import {
  BUSINESS_KIND_LABELS,
  BUSINESS_STATUS_LABELS,
  CREDENTIAL_STATUS_LABELS,
  type Business,
  type BusinessStatus,
  type CredentialStatus,
} from "@gearhead/shared";
import Link from "next/link";

const STATUS_STYLES: Record<BusinessStatus | CredentialStatus, string> = {
  approved: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  suspended: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
};

export function BusinessStatusBadge({ status }: { status: BusinessStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}>
      {status === "approved" ? "✓ " : ""}
      {BUSINESS_STATUS_LABELS[status]}
    </span>
  );
}

export function CredentialStatusBadge({ status }: { status: CredentialStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}>
      {CREDENTIAL_STATUS_LABELS[status]}
    </span>
  );
}

export function BusinessCard({ business, href }: { business: Business; href: string }) {
  return (
    <Link
      href={href}
      className="flex h-full flex-col gap-2 rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-accent"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-lg font-semibold">{business.name}</p>
        <BusinessStatusBadge status={business.status} />
      </div>
      <p className="text-sm text-muted">
        {BUSINESS_KIND_LABELS[business.kind]} · {business.city}/{business.state}
      </p>
      {business.specialties.length > 0 && (
        <ul className="mt-1 flex flex-wrap gap-1.5" aria-label="Especialidades">
          {business.specialties.slice(0, 5).map((s) => (
            <li key={s.id} className="rounded-md bg-background px-2 py-0.5 text-xs">
              {s.name}
            </li>
          ))}
          {business.specialties.length > 5 && (
            <li className="px-1 text-xs text-muted">+{business.specialties.length - 5}</li>
          )}
        </ul>
      )}
    </Link>
  );
}
