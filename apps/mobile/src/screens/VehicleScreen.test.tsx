import type { VehicleWithPlate } from "@gearhead/shared";
import { render, screen } from "@testing-library/react-native";
import { VehicleScreen } from "./VehicleScreen";

jest.mock("@/lib/supabase", () => require("@/test-utils/supabase-mock").module);
jest.mock("@/lib/photos", () => ({ pickVehiclePhoto: jest.fn() }));
jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));
jest.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({ session: { user: { id: "owner-1" } }, loading: false }),
}));

const mockGetVehicle = jest.fn();
jest.mock("@gearhead/shared", () => ({
  ...jest.requireActual("@gearhead/shared"),
  getVehicle: (...args: unknown[]) => mockGetVehicle(...args),
  signPhotoUrls: () => Promise.resolve({ "owner-1/v1/a.jpg": "https://example.test/a.jpg" }),
}));

const base: VehicleWithPlate = {
  id: "v1",
  owner_id: "owner-1",
  make: "Volkswagen",
  model: "Fusca",
  year: 1972,
  nickname: "Bizorrão",
  visibility: "public",
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  photos: [{ id: "p1", storage_path: "owner-1/v1/a.jpg", created_at: "2026-10-01T00:00:00Z" }],
  plate: "FUS1A72",
};

test("dono vê fotos, controles de edição e a placa no formulário", async () => {
  mockGetVehicle.mockResolvedValue(base);
  await render(<VehicleScreen id="v1" />);
  expect(await screen.findByRole("header")).toHaveTextContent("Bizorrão");
  expect(screen.getByText("Fotos (1)")).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Adicionar foto" })).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Remover foto 1" })).toBeOnTheScreen();
  expect(screen.getByDisplayValue("FUS1A72")).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Excluir veículo" })).toBeOnTheScreen();
});

test("visitante de veículo público não vê controles de edição", async () => {
  mockGetVehicle.mockResolvedValue({ ...base, owner_id: "outra-pessoa", plate: null });
  await render(<VehicleScreen id="v1" />);
  expect(await screen.findByRole("header")).toHaveTextContent("Bizorrão");
  expect(screen.queryByRole("button", { name: "Adicionar foto" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Remover foto 1" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Excluir veículo" })).toBeNull();
});

test("veículo inexistente ou privado mostra mensagem", async () => {
  mockGetVehicle.mockResolvedValue(null);
  await render(<VehicleScreen id="v1" />);
  expect(await screen.findByText("Veículo não encontrado")).toBeOnTheScreen();
});
