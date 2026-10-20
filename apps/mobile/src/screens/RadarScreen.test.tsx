import type { RadarResult } from "@gearhead/shared";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { buildMapHtml } from "@/lib/map-html";
import { RadarScreen } from "./RadarScreen";

const mockPush = jest.fn();
jest.mock("@/lib/supabase", () => require("@/test-utils/supabase-mock").module);
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
// WebView não roda no Jest: o mapa é substituído por um marcador de posição.
jest.mock("@/components/MapWebView", () => {
  const { Text } = jest.requireActual("react-native");
  return {
    MapWebView: ({ state }: { state: { markers?: unknown[] } }) => (
      <Text>{`mapa com ${state.markers?.length ?? 0} marcador(es)`}</Text>
    ),
  };
});

const mockLocate = jest.fn();
jest.mock("@/lib/location", () => ({ locateForRadar: () => mockLocate() }));

const mockSearch = jest.fn();
jest.mock("@gearhead/shared", () => ({
  ...jest.requireActual("@gearhead/shared"),
  searchNearby: (...args: unknown[]) => mockSearch(...args),
}));

const result: RadarResult = {
  id: "b1",
  name: "Oficina Exemplo",
  kind: "workshop",
  city: "Curitiba",
  state: "PR",
  latitude: -25.4284,
  longitude: -49.2733,
  distance_m: 380,
  specialty_ids: ["injecao-eletronica"],
};

beforeEach(() => {
  mockSearch.mockReset();
  mockLocate.mockReset();
  mockPush.mockReset();
});

test("usa a localização (arredondada) e lista parceiros por distância", async () => {
  mockLocate.mockResolvedValue({ ok: true, latitude: -25.43, longitude: -49.27 });
  mockSearch.mockResolvedValue([result]);
  await render(<RadarScreen />);
  await fireEvent.press(screen.getByRole("button", { name: "Usar minha localização" }));
  expect(await screen.findByText("1 parceiro(s) em até 10 km")).toBeOnTheScreen();
  expect(mockSearch).toHaveBeenCalledWith(expect.anything(), {
    latitude: -25.43,
    longitude: -49.27,
    radiusKm: 10,
    kind: null,
  });
  expect(screen.getByText("mapa com 1 marcador(es)")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Oficina Exemplo, 380 m" }));
  expect(mockPush).toHaveBeenCalledWith("/parceiros/b1");
});

test("permissão negada mostra alternativa e não busca", async () => {
  mockLocate.mockResolvedValue({ ok: false, reason: "denied" });
  await render(<RadarScreen />);
  await fireEvent.press(screen.getByRole("button", { name: "Usar minha localização" }));
  expect(await screen.findByText(/Sem permissão de localização/)).toBeOnTheScreen();
  expect(mockSearch).not.toHaveBeenCalled();
});

test("mudar o raio refaz a busca no mesmo ponto", async () => {
  mockLocate.mockResolvedValue({ ok: true, latitude: -25.43, longitude: -49.27 });
  mockSearch.mockResolvedValue([]);
  await render(<RadarScreen />);
  await fireEvent.press(screen.getByRole("button", { name: "Usar minha localização" }));
  expect(await screen.findByText(/Nenhum parceiro verificado/)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "50 km" }));
  expect(mockSearch).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.objectContaining({ radiusKm: 50 }),
  );
});

test("HTML do mapa usa MapLibre com SRI e estilo configurável, sem remover a atribuição", () => {
  const html = buildMapHtml("https://exemplo.test/estilo.json");
  expect(html).toMatch(/maplibre-gl@\d+\.\d+\.\d+\/dist\/maplibre-gl\.js" integrity="sha384-/);
  expect(html).toContain('"https://exemplo.test/estilo.json"');
  expect(html).not.toContain("attributionControl: false");
});
