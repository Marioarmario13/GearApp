import { exportMyData } from "@gearhead/shared";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Download dos próprios dados (LGPD: acesso e portabilidade). A RPC só devolve dados
 * do usuário da sessão; arquivos (fotos/documentos) aparecem como caminhos.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Não autenticado", { status: 401 });
  const data = await exportMyData(await createClient());
  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="gearhead-meus-dados-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
