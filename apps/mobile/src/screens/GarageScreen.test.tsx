import type { Vehicle } from "@gearhead/shared";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { GarageScreen } from "./GarageScreen";

const mockPush = jest.fn();
jest.mock("@/lib/supabase", () => require("@/test-utils/supabase-mock").module);
jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual("react");
  const { Text } = jest.requireActual("react-native");
  return {
    Link: ({ children }: { children: string }) => <Text>{children}</Text>,
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
  };
});
jest.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({ session: { user: { id: "owner-1" } }, loading: false }),
}));

const mockList = jest.fn();
jest.mock("@gearhead/shared", () => ({
  ...jest.requireActual("@gearhead/shared"),
  listMyVehicles: (...args: unknown[]) => mockList(...args),
  signPhotoUrls: () => Promise.resolve({}),
}));

const vehicle: Vehicle = {
  id: "v1",
  owner_id: "owner-1",
  make: "Chevrolet",
  model: "Opala",
  year: 1978,
  nickname: null,
  visibility: "private",
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  photos: [],
};

beforeEach(() => mockPush.mockReset());

test("garagem vazia mostra estado vazio", async () => {
  mockList.mockResolvedValue([]);
  await render(<GarageScreen />);
  expect(await screen.findByText("Sua garagem está vazia")).toBeOnTheScreen();
  expect(mockList).toHaveBeenCalledWith(expect.anything(), "owner-1");
});

test("lista veículos e navega para o detalhe", async () => {
  mockList.mockResolvedValue([vehicle]);
  await render(<GarageScreen />);
  const card = await screen.findByRole("button", { name: "Chevrolet Opala 1978" });
  expect(screen.getByText("Privado · 0 foto(s)")).toBeOnTheScreen();
  await fireEvent.press(card);
  expect(mockPush).toHaveBeenCalledWith("/veiculo/v1");
});

test("erro ao carregar mostra mensagem amigável", async () => {
  mockList.mockRejectedValue(new Error("network"));
  await render(<GarageScreen />);
  expect(
    await screen.findByText("Não foi possível concluir a operação. Tente novamente."),
  ).toBeOnTheScreen();
});
