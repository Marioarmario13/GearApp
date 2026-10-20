import { EVENT_KIND_LABELS, formatEventPeriod, spotsLeft, type GearEvent } from "@gearhead/shared";
import Link from "next/link";

const STATUS_BADGE: Record<GearEvent["status"], string | null> = {
  scheduled: null,
  cancelled: "Cancelado",
  removed: "Removido",
};

export function EventCard({ event }: { event: GearEvent }) {
  const spots = spotsLeft(event);
  const badge = STATUS_BADGE[event.status];
  return (
    <Link
      href={`/eventos/${event.id}`}
      className="flex h-full flex-col gap-1.5 rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-accent"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-accent">
        {formatEventPeriod(event.starts_at, event.ends_at)}
      </p>
      <p className="text-lg font-semibold">{event.title}</p>
      <p className="text-sm text-muted">
        {EVENT_KIND_LABELS[event.kind]} · {event.venue_name} · {event.city}/{event.state}
      </p>
      <p className="text-sm">
        {event.attendee_count} confirmado(s)
        {spots !== null ? ` · ${spots === 0 ? "lotado" : `${spots} vaga(s)`}` : ""}
        {badge && (
          <span className="ml-2 font-semibold text-red-600 dark:text-red-400">{badge}</span>
        )}
      </p>
    </Link>
  );
}
