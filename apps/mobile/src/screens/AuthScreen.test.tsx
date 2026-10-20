import { fireEvent, render, screen } from "@testing-library/react-native";
import { mockSupabase } from "@/test-utils/supabase-mock";
import { AuthScreen } from "./AuthScreen";

jest.mock("@/lib/supabase", () => require("@/test-utils/supabase-mock").module);

beforeEach(() => {
  mockSupabase.auth.signInWithPassword.mockReset();
  mockSupabase.auth.signUp.mockReset();
});

test("mostra o formulário de login", async () => {
  await render(<AuthScreen />);
  expect(screen.getByRole("header")).toHaveTextContent("Gearhead");
  expect(screen.getByLabelText("E-mail")).toBeOnTheScreen();
});

test("valida campos antes de chamar o Supabase", async () => {
  await render(<AuthScreen />);
  await fireEvent.press(screen.getByRole("button", { name: "Entrar" }));
  expect(await screen.findByText("E-mail inválido")).toBeOnTheScreen();
  expect(mockSupabase.auth.signInWithPassword).not.toHaveBeenCalled();
});

test("traduz erro de credenciais inválidas", async () => {
  mockSupabase.auth.signInWithPassword.mockResolvedValue({
    data: {},
    error: { code: "invalid_credentials", message: "Invalid login credentials" },
  });
  await render(<AuthScreen />);
  await fireEvent.changeText(screen.getByLabelText("E-mail"), "piloto@gearhead.test");
  await fireEvent.changeText(screen.getByLabelText("Senha"), "errada123");
  await fireEvent.press(screen.getByRole("button", { name: "Entrar" }));
  expect(await screen.findByText("E-mail ou senha incorretos.")).toBeOnTheScreen();
  expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
    email: "piloto@gearhead.test",
    password: "errada123",
  });
});

test("cadastro envia username e nome no metadata", async () => {
  mockSupabase.auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
  await render(<AuthScreen />);
  await fireEvent.press(screen.getByRole("button", { name: "Ainda não tem conta? Criar conta" }));
  await fireEvent.changeText(screen.getByLabelText("Nome"), "Piloto");
  await fireEvent.changeText(screen.getByLabelText("Nome de usuário"), "Piloto_1");
  await fireEvent.changeText(screen.getByLabelText("E-mail"), "novo@gearhead.test");
  await fireEvent.changeText(screen.getByLabelText("Senha"), "senha1234");
  await fireEvent.press(screen.getByRole("button", { name: "Criar conta" }));
  expect(await screen.findByText("Conta criada! Confira seu e-mail.")).toBeOnTheScreen();
  expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
    email: "novo@gearhead.test",
    password: "senha1234",
    options: { data: { username: "piloto_1", display_name: "Piloto" } },
  });
});
