import { render, screen } from "@testing-library/react-native";
import { mockSupabase } from "@/test-utils/supabase-mock";
import { AccountScreen } from "./AccountScreen";

jest.mock("@/lib/supabase", () => require("@/test-utils/supabase-mock").module);

test("mostra perfil e papel de administrador", async () => {
  mockSupabase.query.maybeSingle.mockResolvedValue({
    data: {
      id: "u1",
      username: "admin_gearhead",
      display_name: "Admin Gearhead",
      city: "São Paulo",
      state: "SP",
    },
    error: null,
  });
  mockSupabase.rpc.mockResolvedValueOnce({ data: "admin", error: null });
  await render(<AccountScreen userId="u1" email="admin@gearhead.test" />);
  expect(await screen.findByText("Admin Gearhead")).toBeOnTheScreen();
  expect(screen.getByText("@admin_gearhead")).toBeOnTheScreen();
  expect(screen.getByText("São Paulo — SP")).toBeOnTheScreen();
  expect(screen.getByText("Administrador")).toBeOnTheScreen();
});

test("mostra erro amigável quando o perfil não carrega", async () => {
  mockSupabase.query.maybeSingle.mockResolvedValue({
    data: null,
    error: { code: "x", message: "boom" },
  });
  await render(<AccountScreen userId="u1" email="x@gearhead.test" />);
  expect(await screen.findByText("Não foi possível carregar seu perfil.")).toBeOnTheScreen();
});
