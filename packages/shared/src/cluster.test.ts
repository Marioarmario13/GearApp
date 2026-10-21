import { describe, expect, it } from "vitest";
import { clusterPoints } from "./cluster";

// Três pontos em Curitiba (~1 km entre si) e um em São Paulo.
const points = [
  { id: "a", latitude: -25.4284, longitude: -49.2733 },
  { id: "b", latitude: -25.4374, longitude: -49.2733 },
  { id: "c", latitude: -25.4284, longitude: -49.2633 },
  { id: "sp", latitude: -23.5505, longitude: -46.6333 },
];

describe("clusterPoints", () => {
  it("agrupa pontos próximos e mantém os distantes separados", () => {
    const out = clusterPoints(points, 8);
    const cluster = out.find((c) => c.kind === "cluster");
    expect(cluster).toMatchObject({ kind: "cluster", count: 3, id: "cluster:a" });
    expect(
      out.filter((c) => c.kind === "point").map((c) => c.kind === "point" && c.item.id),
    ).toEqual(["sp"]);
    if (cluster?.kind !== "cluster") throw new Error();
    expect(cluster.latitude).toBeCloseTo(-25.4314, 3);
    expect(cluster.expansionZoom).toBeGreaterThan(8);
    expect(cluster.expansionZoom).toBeLessThanOrEqual(15);
  });

  it("no zoom de expansão o grupo se desfaz", () => {
    const cluster = clusterPoints(points, 8).find((c) => c.kind === "cluster");
    if (cluster?.kind !== "cluster") throw new Error();
    const after = clusterPoints(points, cluster.expansionZoom);
    expect(after.find((c) => c.kind === "cluster" && c.count === 3)).toBeUndefined();
  });

  it("não agrupa a partir do zoom máximo nem com um ponto só", () => {
    expect(clusterPoints(points, 15).every((c) => c.kind === "point")).toBe(true);
    expect(clusterPoints(points.slice(0, 1), 3)).toHaveLength(1);
  });

  it("destacado nunca entra em grupo", () => {
    const out = clusterPoints(
      points.map((p) => (p.id === "b" ? { ...p, highlighted: true } : p)),
      8,
    );
    expect(out.some((c) => c.kind === "point" && c.item.id === "b")).toBe(true);
    expect(out.find((c) => c.kind === "cluster")).toMatchObject({ count: 2 });
  });

  it("pontos idênticos expandem até o zoom máximo", () => {
    const same = [
      { id: "x", latitude: -10, longitude: -50 },
      { id: "y", latitude: -10, longitude: -50 },
    ];
    expect(clusterPoints(same, 5)[0]).toMatchObject({ kind: "cluster", expansionZoom: 15 });
  });
});
