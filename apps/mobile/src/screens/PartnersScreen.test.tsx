import type { Business, BusinessDetails } from "@gearhead/shared";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { PartnerScreen } from "./PartnerScreen";
import { PartnersScreen } from "./PartnersScreen";

const mockPush = jest.fn();
jest.mock("@/lib/supabase", () => require("@/test-utils/supabase-mock").module);
jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: mockPush }),
}));

const mockList = jest.fn();
const mockGet = jest.fn();
jest.mock("@gearhead/shared", () => ({
  ...jest.requireActual("@gearhead/shared"),
  listDirectory: (...args: unknown[]) => mockList(...args),
  getBusiness: (...args: unknown[]) => mockGet(...args),
}));

const business: Business = {
  id: "b1",
  owner_id: "o1",
  kind: "workshop",
  name: "Oficina Exemplo",
  description: null,
  phone: "41999990000",
  phone_is_whatsapp: true,
  email: null,
  website: null,
  street: null,
  street_number: null,
  district: null,
  city: "Curitiba",
  state: "PR",
  postal_code: null,
  latitude: -25.4284,
  longitude: -49.2733,
  status: "approved",
  reviewed_at: "2026-10-20T12:00:00Z",
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  specialties: [{ id: "injecao-eletronica", name: "Injeção eletrônica" }],
};

beforeEach(() => {
  mockList.mockReset();
  mockGet.mockReset();
  mockPush.mockReset();
});

test("lista parceiros e navega para o detalhe", async () => {
  mockList.mockResolvedValue({ items: [business], hasMore: false });
  await render(<PartnersScreen />);
  const card = await screen.findByRole("button", { name: "Oficina Exemplo" });
  expect(screen.getByText("Injeção eletrônica")).toBeOnTheScreen();
  await fireEvent.press(card);
  expect(mockPush).toHaveBeenCalledWith("/parceiros/b1");
});

test("filtro por tipo recarrega a primeira página", async () => {
  mockList.mockResolvedValue({ items: [], hasMore: false });
  await render(<PartnersScreen />);
  expect(await screen.findByText("Nenhum parceiro encontrado")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Preparador" }));
  expect(mockList).toHaveBeenLastCalledWith(expect.anything(), {
    kind: "tuner",
    city: "",
    page: 1,
  });
});

test("carregar mais busca a próxima página e acumula", async () => {
  mockList.mockResolvedValueOnce({ items: [business], hasMore: true }).mockResolvedValueOnce({
    items: [{ ...business, id: "b2", name: "Outra Oficina" }],
    hasMore: false,
  });
  await render(<PartnersScreen />);
  await fireEvent.press(await screen.findByRole("button", { name: "Carregar mais" }));
  expect(await screen.findByRole("button", { name: "Outra Oficina" })).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Oficina Exemplo" })).toBeOnTheScreen();
});

test("detalhe mostra só credenciais conferidas", async () => {
  const details: BusinessDetails = {
    ...business,
    credentials: [
      {
        id: "c1",
        type: "business_registration",
        title: "CNPJ",
        issuer: null,
        specialty_id: null,
        issued_on: null,
        expires_on: null,
        status: "approved",
        reviewed_at: "2026-10-20T12:00:00Z",
      },
      {
        id: "c2",
        type: "certification",
        title: "Curso pendente",
        issuer: null,
        specialty_id: null,
        issued_on: null,
        expires_on: null,
        status: "pending",
        reviewed_at: null,
      },
    ],
  };
  mockGet.mockResolvedValue(details);
  await render(<PartnerScreen id="b1" />);
  expect(await screen.findByRole("header")).toHaveTextContent("Oficina Exemplo");
  expect(screen.getByText("✓ CNPJ")).toBeOnTheScreen();
  expect(screen.queryByText(/Curso pendente/)).toBeNull();
  expect(screen.getByRole("button", { name: "Conversar no WhatsApp" })).toBeOnTheScreen();
});

test("parceiro inexistente ou não verificado mostra mensagem", async () => {
  mockGet.mockResolvedValue(null);
  await render(<PartnerScreen id="x" />);
  expect(await screen.findByText("Parceiro não encontrado")).toBeOnTheScreen();
});
