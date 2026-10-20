import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import App from "./App";

// Cliente Supabase falso: os testes de UI não acessam rede. RLS é testada em supabase/tests.
jest.mock("./src/lib/supabase", () => {
  const query = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(),
  };
  return {
    supabase: {
      auth: {
        getSession: jest.fn(),
        onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
        signInWithPassword: jest.fn(),
        signUp: jest.fn(),
        signOut: jest.fn(),
      },
      from: jest.fn(() => query),
      rpc: jest.fn(() => Promise.resolve({ data: "admin", error: null })),
      __query: query,
    },
  };
});

interface MockClient {
  auth: Record<"getSession" | "signInWithPassword", jest.Mock>;
  __query: Record<"maybeSingle", jest.Mock>;
}
const { supabase: mockSupabase } = jest.requireMock<{ supabase: MockClient }>("./src/lib/supabase");
const mockAuth = mockSupabase.auth;
const mockQuery = mockSupabase.__query;

beforeEach(() => {
  mockAuth.getSession.mockReset().mockResolvedValue({ data: { session: null } });
  mockAuth.signInWithPassword.mockReset();
});

test("sem sessão, mostra a tela de login", async () => {
  await render(<App />);
  expect(await screen.findByRole("header")).toHaveTextContent("Gearhead");
  expect(screen.getByLabelText("E-mail")).toBeOnTheScreen();
});

test("valida campos antes de chamar o Supabase", async () => {
  await render(<App />);
  await fireEvent.press(await screen.findByRole("button", { name: "Entrar" }));
  expect(await screen.findByText("E-mail inválido")).toBeOnTheScreen();
  expect(mockAuth.signInWithPassword).not.toHaveBeenCalled();
});

test("traduz erro de credenciais inválidas", async () => {
  mockAuth.signInWithPassword.mockResolvedValue({
    data: {},
    error: { code: "invalid_credentials", message: "Invalid login credentials" },
  });
  await render(<App />);
  await fireEvent.changeText(await screen.findByLabelText("E-mail"), "piloto@gearhead.test");
  await fireEvent.changeText(screen.getByLabelText("Senha"), "errada123");
  await fireEvent.press(screen.getByRole("button", { name: "Entrar" }));
  expect(await screen.findByText("E-mail ou senha incorretos.")).toBeOnTheScreen();
  expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
    email: "piloto@gearhead.test",
    password: "errada123",
  });
});

test("com sessão, mostra a conta e o papel", async () => {
  mockAuth.getSession.mockResolvedValue({
    data: { session: { user: { id: "u1", email: "admin@gearhead.test" } } },
  });
  mockQuery.maybeSingle.mockResolvedValue({
    data: {
      id: "u1",
      username: "admin_gearhead",
      display_name: "Admin Gearhead",
      city: null,
      state: null,
    },
    error: null,
  });
  await render(<App />);
  expect(await screen.findByText("Admin Gearhead")).toBeOnTheScreen();
  await waitFor(() => expect(screen.getByText("Administrador")).toBeOnTheScreen());
  expect(screen.getByText("@admin_gearhead")).toBeOnTheScreen();
});
