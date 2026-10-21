import type { Session } from "@supabase/supabase-js";
import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { supabase } from "@/lib/supabase";

/**
 * Confere no servidor se a sessão guardada ainda vale (ex.: conta suspensa encerra as
 * sessões). Só sai quando o servidor recusa (401/403); falha de rede mantém a sessão.
 */
export async function validateStoredSession(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;
  const { error } = await supabase.auth.getUser();
  if (error && (error.status === 401 || error.status === 403)) {
    await supabase.auth.signOut({ scope: "local" });
  }
}

interface AuthState {
  session: Session | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true });

  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setState({ session: data.session, loading: false });
      })
      .catch(() => {
        if (active) setState({ session: null, loading: false });
      });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, loading: false });
    });

    void validateStoredSession().catch(() => undefined);
    const appState = AppState.addEventListener("change", (s) => {
      if (s === "active") void validateStoredSession().catch(() => undefined);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
      appState.remove();
    };
  }, []);

  return <AuthContext value={state}>{children}</AuthContext>;
}

export function useAuth(): AuthState {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
