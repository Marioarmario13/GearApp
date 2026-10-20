import {
  BUSINESS_KIND_LABELS,
  CREDENTIAL_TYPE_LABELS,
  directionsUrl,
  formatPhone,
  formatPostalCode,
  getBusiness,
  isExpired,
  whatsappLink,
} from "@gearhead/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LazyMapView } from "@/components/map/lazy-map";
import { BusinessStatusBadge } from "@/components/partners";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Parceiro — Gearhead" };

const dateBR = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("pt-BR");

export default function PartnerPage({ params }: PageProps<"/parceiros/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-12">
      <Link href="/parceiros" className="text-sm text-muted hover:underline">
        ← Parceiros
      </Link>
      <Suspense fallback={<p className="text-muted">Carregando…</p>}>
        <Partner params={params} />
      </Suspense>
    </main>
  );
}

async function Partner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // RLS: público só vê aprovados; dono e admin veem também pendentes.
  const business = await getBusiness(await createClient(), id);
  if (!business) notFound();

  // Mesmo para dono/admin, a página pública só lista credenciais conferidas.
  const credentials = business.credentials.filter((c) => c.status === "approved");
  const phone = formatPhone(business.phone);
  const whatsapp = whatsappLink(business.phone, business.phone_is_whatsapp);
  const address = [
    [business.street, business.street_number].filter(Boolean).join(", "),
    business.district,
    `${business.city}/${business.state}`,
    formatPostalCode(business.postal_code),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      {business.status !== "approved" && (
        <p
          role="status"
          className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          Pré-visualização: este cadastro ainda não está público.
        </p>
      )}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{business.name}</h1>
          <BusinessStatusBadge status={business.status} />
        </div>
        <p className="text-muted">{BUSINESS_KIND_LABELS[business.kind]}</p>
        {business.status === "approved" && business.reviewed_at && (
          <p className="text-xs text-muted">
            Registro conferido pela equipe Gearhead em {dateBR(business.reviewed_at)}.
          </p>
        )}
      </header>

      {business.description && <p className="whitespace-pre-line">{business.description}</p>}

      <section
        aria-labelledby="contato"
        className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-5"
      >
        <h2 id="contato" className="text-lg font-semibold">
          Contato e endereço
        </h2>
        <p className="text-sm">{address}</p>
        <div className="flex flex-wrap gap-4 text-sm">
          {phone && (
            <a href={`tel:+55${business.phone}`} className="text-accent hover:underline">
              {phone}
            </a>
          )}
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              WhatsApp
            </a>
          )}
          {business.email && (
            <a href={`mailto:${business.email}`} className="text-accent hover:underline">
              {business.email}
            </a>
          )}
          {business.website && (
            <a
              href={business.website}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-accent hover:underline"
            >
              Site
            </a>
          )}
        </div>
      </section>

      {business.latitude !== null && business.longitude !== null && (
        <section aria-labelledby="mapa" className="flex flex-col gap-2">
          <h2 id="mapa" className="text-lg font-semibold">
            No mapa
          </h2>
          <LazyMapView
            ariaLabel={`Localização de ${business.name}`}
            center={{ latitude: business.latitude, longitude: business.longitude }}
            zoom={15}
            markers={[
              {
                id: business.id,
                latitude: business.latitude,
                longitude: business.longitude,
                label: business.name,
                highlighted: true,
              },
            ]}
            className="h-64 w-full overflow-hidden rounded-xl border border-line"
          />
          <a
            href={directionsUrl(business.latitude, business.longitude)}
            target="_blank"
            rel="noopener noreferrer"
            className="self-start text-sm font-medium text-accent hover:underline"
          >
            Como chegar (OpenStreetMap) →
          </a>
        </section>
      )}

      {business.specialties.length > 0 && (
        <section aria-labelledby="especialidades" className="flex flex-col gap-2">
          <h2 id="especialidades" className="text-lg font-semibold">
            Especialidades
          </h2>
          <ul className="flex flex-wrap gap-2">
            {business.specialties.map((s) => (
              <li key={s.id} className="rounded-md border border-line px-2.5 py-1 text-sm">
                {s.name}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">
            Especialidades são informadas pelo próprio estabelecimento.
          </p>
        </section>
      )}

      <section aria-labelledby="credenciais" className="flex flex-col gap-2">
        <h2 id="credenciais" className="text-lg font-semibold">
          Documentos e certificações conferidos
        </h2>
        {credentials.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma certificação conferida ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {credentials.map((c) => (
              <li key={c.id} className="rounded-xl border border-line p-4">
                <p className="font-medium">✓ {c.title}</p>
                <p className="text-sm text-muted">
                  {CREDENTIAL_TYPE_LABELS[c.type]}
                  {c.issuer ? ` · ${c.issuer}` : ""}
                  {c.reviewed_at ? ` · conferido em ${dateBR(c.reviewed_at)}` : ""}
                  {c.expires_on
                    ? ` · ${isExpired(c.expires_on) ? "vencido em" : "válido até"} ${dateBR(c.expires_on)}`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
