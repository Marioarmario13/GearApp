import {
  directionsUrl,
  EVENT_KIND_HINTS,
  EVENT_KIND_LABELS,
  formatEventPeriod,
  getBusiness,
  getEvent,
  getEventAttendees,
  isGoing,
  listMyBusinesses,
  spotsLeft,
} from "@gearhead/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  cancelEventAction,
  leaveEventAction,
  removeEventAction,
  rsvpAction,
  setEventLocationAction,
  updateEventAction,
} from "@/app/actions/events";
import { LazyMapView } from "@/components/map/lazy-map";
import { LocationPicker } from "@/components/map/location-picker";
import { getCurrentUser, getMyRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EventForm } from "../event-form";
import { ReasonForm, RsvpButton } from "./event-controls";

export const metadata: Metadata = { title: "Evento — Gearhead" };

export default function EventPage({ params }: PageProps<"/eventos/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-12">
      <Link href="/eventos" className="text-sm text-muted hover:underline">
        ← Eventos
      </Link>
      <Suspense fallback={<p className="text-muted">Carregando…</p>}>
        <EventDetails params={params} />
      </Suspense>
    </main>
  );
}

async function EventDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [event, user] = await Promise.all([getEvent(supabase, id), getCurrentUser()]);
  if (!event) notFound();

  const isOrganizer = user?.id === event.organizer_id;
  const [going, role, host] = await Promise.all([
    user ? isGoing(supabase, id, user.id) : Promise.resolve(false),
    user ? getMyRole() : Promise.resolve(null),
    event.business_id ? getBusiness(supabase, event.business_id) : Promise.resolve(null),
  ]);
  const ended = new Date(event.ends_at) <= new Date();
  const spots = spotsLeft(event);
  const disabledReason =
    event.status !== "scheduled"
      ? "Este evento não está mais aberto."
      : ended
        ? "Este evento já terminou."
        : spots === 0
          ? "Não há mais vagas."
          : null;
  const hint = EVENT_KIND_HINTS[event.kind];

  return (
    <>
      {event.status !== "scheduled" && (
        <p
          role="status"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-300"
        >
          {event.status === "cancelled" ? "Evento cancelado" : "Evento removido pela moderação"}
          {event.status_note ? `: ${event.status_note}` : "."}
        </p>
      )}
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-wider text-accent">
          {formatEventPeriod(event.starts_at, event.ends_at)}
        </p>
        <h1 className="text-3xl font-bold tracking-tight">{event.title}</h1>
        <p className="text-muted">
          {EVENT_KIND_LABELS[event.kind]} · {event.venue_name} · {event.city}/{event.state}
        </p>
        {host && (
          <p className="text-sm">
            Anfitrião:{" "}
            <Link href={`/parceiros/${host.id}`} className="text-accent hover:underline">
              ✓ {host.name}
            </Link>
          </p>
        )}
      </header>

      {hint && <p className="text-sm text-muted">{hint}</p>}
      {event.description && <p className="whitespace-pre-line">{event.description}</p>}

      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
        <p className="font-semibold">
          {event.attendee_count} confirmado(s)
          {spots !== null && ` · ${spots === 0 ? "lotado" : `${spots} vaga(s) restante(s)`}`}
        </p>
        <RsvpButton
          going={going}
          signedIn={Boolean(user)}
          disabledReason={disabledReason}
          eventId={event.id}
          rsvp={rsvpAction.bind(null, event.id)}
          leave={leaveEventAction.bind(null, event.id)}
        />
      </section>

      {event.latitude !== null && event.longitude !== null && (
        <section className="flex flex-col gap-2">
          <LazyMapView
            ariaLabel={`Local do evento ${event.title}`}
            center={{ latitude: event.latitude, longitude: event.longitude }}
            zoom={15}
            markers={[
              {
                id: event.id,
                latitude: event.latitude,
                longitude: event.longitude,
                label: event.venue_name,
                highlighted: true,
              },
            ]}
            className="h-64 w-full overflow-hidden rounded-xl border border-line"
          />
          <a
            href={directionsUrl(event.latitude, event.longitude)}
            target="_blank"
            rel="noopener noreferrer"
            className="self-start text-sm font-medium text-accent hover:underline"
          >
            Como chegar (OpenStreetMap) →
          </a>
        </section>
      )}

      {isOrganizer && event.status === "scheduled" && !ended && (
        <Suspense fallback={<p className="text-muted">Carregando painel do organizador…</p>}>
          <OrganizerPanel eventId={event.id} userId={user!.id} />
        </Suspense>
      )}

      {role === "admin" && event.status !== "removed" && (
        <section className="rounded-2xl border border-red-300 p-5 dark:border-red-900">
          <h2 className="mb-3 text-lg font-semibold">Moderação</h2>
          <ReasonForm
            action={removeEventAction.bind(null, event.id)}
            label="Remover evento"
            pendingLabel="Removendo…"
            noteLabel="Motivo (obrigatório, fica na auditoria)"
          />
        </section>
      )}
    </>
  );
}

async function OrganizerPanel({ eventId, userId }: { eventId: string; userId: string }) {
  const supabase = await createClient();
  const [event, attendees, businesses] = await Promise.all([
    getEvent(supabase, eventId),
    getEventAttendees(supabase, eventId),
    listMyBusinesses(supabase, userId),
  ]);
  if (!event) return null;
  const hosts = businesses
    .filter((b) => b.status === "approved")
    .map((b) => ({ value: b.id, label: b.name }));

  return (
    <>
      <section className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">Confirmados ({attendees.length})</h2>
        {attendees.length === 0 ? (
          <p className="text-sm text-muted">Ninguém confirmou ainda.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {attendees.map((a) => (
              <li key={a.user_id}>
                {a.display_name ?? "Sem nome"}
                {a.username ? <span className="text-muted"> @{a.username}</span> : null}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted">Visível só para você, organizador.</p>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-3 text-lg font-semibold">Local no mapa</h2>
        <LocationPicker
          action={setEventLocationAction.bind(null, eventId)}
          initial={
            event.latitude !== null && event.longitude !== null
              ? { latitude: event.latitude, longitude: event.longitude }
              : null
          }
        />
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-3 text-lg font-semibold">Editar evento</h2>
        <EventForm
          action={updateEventAction.bind(null, eventId)}
          event={event}
          hostOptions={hosts}
          submitLabel="Salvar alterações"
        />
      </section>

      <section className="rounded-2xl border border-red-300 p-5 dark:border-red-900">
        <h2 className="mb-3 text-lg font-semibold">Cancelar evento</h2>
        <ReasonForm
          action={cancelEventAction.bind(null, eventId)}
          label="Cancelar evento"
          pendingLabel="Cancelando…"
          noteLabel="Aviso aos participantes (opcional)"
        />
      </section>
    </>
  );
}
