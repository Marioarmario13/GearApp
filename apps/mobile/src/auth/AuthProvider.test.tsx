import { mockSupabase } from "@/test-utils/supabase-mock";
import { validateStoredSession } from "./AuthProvider";

jest.mock("@/lib/supabase", () => require("@/test-utils/supabase-mock").module);

const session = { access_token: "t" };

beforeEach(() => {
  mockSupabase.auth.getSession.mockReset();
  mockSupabase.auth.getUser.mockReset();
  mockSupabase.auth.signOut.mockReset();
});

test.each([401, 403])(
  "sai quando o servidor recusa a sessão (%i, ex.: conta suspensa)",
  async (status) => {
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session } });
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: { status } });
    await validateStoredSession();
    expect(mockSupabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  },
);

test("mantém a sessão em falha de rede ou quando ela vale", async () => {
  mockSupabase.auth.getSession.mockResolvedValue({ data: { session } });
  mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: { status: 0 } });
  await validateStoredSession();
  mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: "u" } }, error: null });
  await validateStoredSession();
  expect(mockSupabase.auth.signOut).not.toHaveBeenCalled();
});

test("sem sessão guardada não consulta o servidor", async () => {
  mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null } });
  await validateStoredSession();
  expect(mockSupabase.auth.getUser).not.toHaveBeenCalled();
});
