import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/env";

const PROTECTED_PREFIXES = [
  "/conta",
  "/garagem",
  "/meus-parceiros",
  "/admin",
  "/eventos/novo",
  "/eventos/meus",
  "/meus-cupons",
  "/amigos",
  "/localizacao",
  "/u/",
];
const GUEST_ONLY = ["/entrar", "/cadastro"];

/**
 * Renova a sessão do Supabase (cookies) e faz redirecionamentos otimistas.
 * Não é a camada de autorização: páginas e actions verificam o usuário de novo
 * (src/lib/auth.ts) e o banco aplica RLS.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = getSupabaseEnv();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [name, value] of Object.entries(headers ?? {})) {
          response.headers.set(name, value);
        }
      },
    },
  });

  // Não colocar código entre a criação do cliente e getClaims(): é aqui que a sessão é renovada.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims);
  const { pathname } = request.nextUrl;

  if (!isSignedIn && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const target = request.nextUrl.clone();
    target.pathname = "/entrar";
    target.search = `?next=${encodeURIComponent(pathname)}`;
    return redirectKeepingCookies(target, response);
  }

  if (isSignedIn && GUEST_ONLY.includes(pathname)) {
    const target = request.nextUrl.clone();
    target.pathname = "/conta";
    target.search = "";
    return redirectKeepingCookies(target, response);
  }

  return response;
}

function redirectKeepingCookies(target: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(target);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
