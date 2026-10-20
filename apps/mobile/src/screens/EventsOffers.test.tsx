import type { GearEvent, Offer } from "@gearhead/shared";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { EventScreen, EventsScreen } from "./EventsScreens";
import { OfferScreen } from "./OffersScreens";

const mockPush = jest.fn();
jest.mock("@/lib/supabase", () => require("@/test-utils/supabase-mock").module);
jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: mockPush }),
}));
jest.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({ session: { user: { id: "u1" } }, loading: false }),
}));

const mock = {
  listUpcomingEvents: jest.fn(),
  getEvent: jest.fn(),
  isGoing: jest.fn(),
  rsvpEvent: jest.fn(),
  leaveEvent: jest.fn(),
  getOffer: jest.fn(),
  claimOffer: jest.fn(),
};
jest.mock("@gearhead/shared", () => ({
  ...jest.requireActual("@gearhead/shared"),
  listUpcomingEvents: (...a: unknown[]) => mock.listUpcomingEvents(...a),
  getEvent: (...a: unknown[]) => mock.getEvent(...a),
  isGoing: (...a: unknown[]) => mock.isGoing(...a),
  rsvpEvent: (...a: unknown[]) => mock.rsvpEvent(...a),
  leaveEvent: (...a: unknown[]) => mock.leaveEvent(...a),
  getOffer: (...a: unknown[]) => mock.getOffer(...a),
  claimOffer: (...a: unknown[]) => mock.claimOffer(...a),
}));

const event: GearEvent = {
  id: "e1",
  organizer_id: "o1",
  business_id: null,
  kind: "cruise",
  title: "Passeio da Serra",
  description: null,
  starts_at: "2099-11-01T12:00:00Z",
  ends_at: "2099-11-01T16:00:00Z",
  venue_name: "Posto X",
  street: null,
  street_number: null,
  district: null,
  city: "Curitiba",
  state: "PR",
  latitude: null,
  longitude: null,
  capacity: 10,
  attendee_count: 9,
  status: "scheduled",
  status_note: null,
};

beforeEach(() => Object.values(mock).forEach((m) => m.mockReset()));

test("lista eventos e abre o detalhe", async () => {
  mock.listUpcomingEvents.mockResolvedValue({ items: [event], hasMore: false });
  await render(<EventsScreen />);
  await fireEvent.press(await screen.findByRole("button", { name: "Passeio da Serra" }));
  expect(mockPush).toHaveBeenCalledWith("/eventos/e1");
  expect(screen.getByText(/1 vaga\(s\)/)).toBeOnTheScreen();
});

test("confirma presença e mostra aviso de segurança do passeio", async () => {
  mock.getEvent
    .mockResolvedValueOnce(event)
    .mockResolvedValueOnce({ ...event, attendee_count: 10 });
  mock.isGoing.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  mock.rsvpEvent.mockResolvedValue(10);
  await render(<EventScreen id="e1" />);
  expect(await screen.findByText(/leis de trânsito/)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Confirmar presença" }));
  expect(await screen.findByText("Presença confirmada.")).toBeOnTheScreen();
  expect(mock.rsvpEvent).toHaveBeenCalledWith(expect.anything(), "e1");
  expect(screen.getByRole("button", { name: "Cancelar minha presença" })).toBeOnTheScreen();
});

test("evento lotado não oferece confirmação", async () => {
  mock.getEvent.mockResolvedValue({ ...event, attendee_count: 10 });
  mock.isGoing.mockResolvedValue(false);
  await render(<EventScreen id="e1" />);
  expect(await screen.findByText("Não há mais vagas.")).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "Confirmar presença" })).toBeNull();
});

test("pegar cupom mostra o código formatado", async () => {
  const offer: Offer = {
    id: "of1",
    business_id: "b1",
    title: "Troca de óleo",
    description: null,
    discount_label: "10% OFF",
    terms: null,
    starts_at: "2026-10-01T00:00:00Z",
    ends_at: "2099-12-31T00:00:00Z",
    max_redemptions: null,
    per_user_limit: 1,
    issued_count: 0,
    status: "active",
    business: { id: "b1", name: "Oficina X", city: "Curitiba", state: "PR" },
  };
  mock.getOffer.mockResolvedValue(offer);
  mock.claimOffer.mockResolvedValueOnce({
    code: "ABCD2345",
    coupon_id: "c1",
    expires_at: offer.ends_at,
  });
  await render(<OfferScreen id="of1" />);
  await fireEvent.press(await screen.findByRole("button", { name: "Pegar cupom" }));
  expect(await screen.findByText("ABCD-2345")).toBeOnTheScreen();
});
