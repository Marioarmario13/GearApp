"use client";

import { BRAZIL_CENTER, isInsideBrazil } from "@gearhead/shared";
import { useActionState, useMemo, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { LazyMapView } from "@/components/map/lazy-map";
import type { FormState } from "@/lib/forms";

interface Point {
  latitude: number;
  longitude: number;
}

/** Pin manual no mapa (sem geocodificação externa — ver docs/MAPS.md). */
export function LocationPicker({
  action,
  initial,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial: Point | null;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const [point, setPoint] = useState<Point | null>(initial);
  const [view, setView] = useState<Point & { zoom: number }>(
    initial ? { ...initial, zoom: 15 } : { ...BRAZIL_CENTER },
  );
  const [hint, setHint] = useState<string | null>(null);

  const markers = useMemo(
    () => (point ? [{ id: "pin", ...point, label: "Seu estabelecimento", highlighted: true }] : []),
    [point],
  );

  function place(p: Point) {
    if (!isInsideBrazil(p.latitude, p.longitude)) {
      setHint("Escolha um ponto dentro do Brasil.");
      return;
    }
    setHint(null);
    setPoint(p);
  }

  function locateHere() {
    if (!("geolocation" in navigator)) return setHint("Seu navegador não oferece localização.");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        place(p);
        setView({ ...p, zoom: 17 });
      },
      () => setHint("Não foi possível obter a localização. Clique no mapa."),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormMessage error={hint ?? state.error} success={hint ? undefined : state.success} />
      <p className="text-sm text-muted">
        Clique no mapa no ponto exato do estabelecimento. Ele aparece no Radar para quem busca por
        perto.
      </p>
      <LazyMapView
        ariaLabel="Mapa para posicionar o estabelecimento"
        center={view}
        zoom={view.zoom}
        markers={markers}
        onMapClick={place}
        className="h-80 w-full overflow-hidden rounded-xl border border-line"
      />
      <input type="hidden" name="latitude" value={point?.latitude ?? ""} />
      <input type="hidden" name="longitude" value={point?.longitude ?? ""} />
      <p className="text-xs text-muted" aria-live="polite">
        {point
          ? `Ponto escolhido: ${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`
          : "Nenhum ponto escolhido."}
      </p>
      <div className="flex flex-wrap gap-2">
        <SubmitButton pendingText="Salvando…" name="intent" value="save">
          Salvar localização
        </SubmitButton>
        <button
          type="button"
          onClick={locateHere}
          className="rounded-lg border border-line px-4 py-2.5 text-sm font-medium hover:bg-background"
        >
          Estou no local agora
        </button>
        {initial && (
          <SubmitButton pendingText="Removendo…" name="intent" value="clear" variant="secondary">
            Remover do mapa
          </SubmitButton>
        )}
      </div>
    </form>
  );
}
