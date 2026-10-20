/**
 * Cliente Supabase falso para testes de UI (sem rede). Use em cada arquivo de teste:
 *   jest.mock("@/lib/supabase", () => require("@/test-utils/supabase-mock").module);
 * Regras de acesso reais são testadas em supabase/tests (pgTAP) e na integração do shared.
 */
const query = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn(),
};

export const mockSupabase = {
  auth: {
    getSession: jest.fn(),
    onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
  },
  from: jest.fn(() => query),
  rpc: jest.fn(() => Promise.resolve({ data: "user", error: null })),
  query,
};

export const module = { supabase: mockSupabase };
