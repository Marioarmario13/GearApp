import { fireEvent, render, screen } from "@testing-library/react-native";
import { LocationScreen } from "./LocationScreen";

jest.mock("@/lib/supabase", () => require("@/test-utils/supabase-mock").module);
jest.mock("@/components/MapWebView", () => ({ MapWebView: () => null }));
jest.mock("expo-location", () => ({
  Accuracy: { Low: 2, High: 4 },
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  watchPositionAsync: jest.fn(() => Promise.resolve({ remove: jest.fn() })),
  getCurrentPositionAsync: jest.fn(() =>
    Promise.resolve({ coords: { latitude: -25.4284, longitude: -49.2733 } }),
  ),
}));

const mock = {
  listMyFriendships: jest.fn(),
  getMyLocationSession: jest.fn(),
  listSharedWithMe: jest.fn(),
  startLocationSession: jest.fn(),
  stopLocationSession: jest.fn(),
  listNearbyFriends: jest.fn(),
};
jest.mock("@gearhead/shared", () => ({
  ...jest.requireActual("@gearhead/shared"),
  listMyFriendships: (...a: unknown[]) => mock.listMyFriendships(...a),
  getMyLocationSession: (...a: unknown[]) => mock.getMyLocationSession(...a),
  listSharedWithMe: (...a: unknown[]) => mock.listSharedWithMe(...a),
  startLocationSession: (...a: unknown[]) => mock.startLocationSession(...a),
  stopLocationSession: (...a: unknown[]) => mock.stopLocationSession(...a),
  listNearbyFriends: (...a: unknown[]) => mock.listNearbyFriends(...a),
}));

const friend = {
  friendship_id: "f1",
  other_id: "u2",
  username: "bia",
  display_name: "Bia",
  status: "accepted",
  incoming: false,
  created_at: "",
};

beforeEach(() => {
  Object.values(mock).forEach((m) => m.mockReset());
  mock.listMyFriendships.mockResolvedValue([friend]);
  mock.listSharedWithMe.mockResolvedValue([]);
});

test("inicia compartilhamento só com amigos escolhidos", async () => {
  mock.getMyLocationSession.mockResolvedValue(null);
  mock.startLocationSession.mockResolvedValue("s1");
  await render(<LocationScreen />);
  await fireEvent.press(await screen.findByRole("checkbox", { name: "Bia" }));
  await fireEvent.press(screen.getByRole("radio", { name: "Comboio/passeio" }));
  await fireEvent.press(screen.getByRole("button", { name: "Iniciar compartilhamento" }));
  expect(mock.startLocationSession).toHaveBeenCalledWith(expect.anything(), {
    purpose: "convoy",
    minutes: 60,
    recipientIds: ["u2"],
    note: null,
  });
});

test("sessão ativa mostra destinatários e permite parar na hora", async () => {
  mock.getMyLocationSession.mockResolvedValue({
    id: "s1",
    purpose: "meetup",
    purpose_note: null,
    started_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
    position_at: null,
    recipients: [{ id: "u2", username: "bia", display_name: "Bia" }],
  });
  mock.stopLocationSession.mockResolvedValue(undefined);
  await render(<LocationScreen />);
  expect(await screen.findByText(/Com: Bia/)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Parar de compartilhar agora" }));
  expect(mock.stopLocationSession).toHaveBeenCalledWith(expect.anything(), "s1");
});

test("amigos por perto mostram só faixa de distância", async () => {
  mock.getMyLocationSession.mockResolvedValue(null);
  mock.listNearbyFriends.mockResolvedValue([
    { user_id: "u2", username: "bia", display_name: "Bia", distance_band: "até 5 km", until: "" },
  ]);
  await render(<LocationScreen />);
  await fireEvent.press(await screen.findByRole("button", { name: "Ver amigos por perto" }));
  expect(await screen.findByText("Bia · até 5 km")).toBeOnTheScreen();
  // A posição enviada já é arredondada (~1 km).
  expect(mock.listNearbyFriends).toHaveBeenCalledWith(expect.anything(), {
    latitude: -25.43,
    longitude: -49.27,
  });
});
