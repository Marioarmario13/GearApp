"use client";

import dynamic from "next/dynamic";

/** MapLibre depende de window/WebGL: carregado só no navegador. */
export const LazyMapView = dynamic(() => import("./map-view").then((m) => m.MapView), {
  ssr: false,
  loading: () => (
    <div className="flex h-80 w-full items-center justify-center rounded-xl bg-surface text-sm text-muted">
      Carregando mapa…
    </div>
  ),
});
