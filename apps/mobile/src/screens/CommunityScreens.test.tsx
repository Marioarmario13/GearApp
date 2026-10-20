import { fireEvent, render, screen } from "@testing-library/react-native";
import { FriendsScreen, ReportSection } from "./CommunityScreens";

jest.mock("@/lib/supabase", () => require("@/test-utils/supabase-mock").module);

const mock = {
  listMyFriendships: jest.fn(),
  listMyBlocks: jest.fn(),
  respondFriendRequest: jest.fn(),
  submitReport: jest.fn(),
};
jest.mock("@gearhead/shared", () => ({
  ...jest.requireActual("@gearhead/shared"),
  listMyFriendships: (...a: unknown[]) => mock.listMyFriendships(...a),
  listMyBlocks: (...a: unknown[]) => mock.listMyBlocks(...a),
  respondFriendRequest: (...a: unknown[]) => mock.respondFriendRequest(...a),
  submitReport: (...a: unknown[]) => mock.submitReport(...a),
}));

beforeEach(() => Object.values(mock).forEach((m) => m.mockReset()));

test("aceita pedido de amizade e recarrega a lista", async () => {
  mock.listMyFriendships
    .mockResolvedValueOnce([
      {
        friendship_id: "f1",
        other_id: "u2",
        username: "bia",
        display_name: "Bia",
        status: "pending",
        incoming: true,
        created_at: "",
      },
    ])
    .mockResolvedValueOnce([
      {
        friendship_id: "f1",
        other_id: "u2",
        username: "bia",
        display_name: "Bia",
        status: "accepted",
        incoming: true,
        created_at: "",
      },
    ]);
  mock.listMyBlocks.mockResolvedValue([]);
  mock.respondFriendRequest.mockResolvedValue(undefined);
  await render(<FriendsScreen />);
  await fireEvent.press(await screen.findByRole("button", { name: "Aceitar" }));
  expect(mock.respondFriendRequest).toHaveBeenCalledWith(expect.anything(), "f1", true);
  expect(await screen.findByText("Amigos (1)")).toBeOnTheScreen();
});

test("denúncia exige motivo e envia para o alvo correto", async () => {
  mock.submitReport.mockResolvedValue(undefined);
  await render(<ReportSection targetType="event" targetId="e1" />);
  await fireEvent.press(screen.getByRole("button", { name: "Denunciar" }));
  await fireEvent.press(screen.getByRole("button", { name: "Enviar denúncia" }));
  expect(await screen.findByText("Escolha o motivo.")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("radio", { name: /racha/ }));
  await fireEvent.press(screen.getByRole("button", { name: "Enviar denúncia" }));
  expect(await screen.findByText("Denúncia enviada. Obrigado!")).toBeOnTheScreen();
  expect(mock.submitReport).toHaveBeenCalledWith(expect.anything(), {
    targetType: "event",
    targetId: "e1",
    reason: "dangerous_driving",
    details: null,
  });
});
