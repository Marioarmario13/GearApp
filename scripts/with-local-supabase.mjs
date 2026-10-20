#!/usr/bin/env node
// Executa um comando com SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY do Supabase LOCAL.
// Uso: node scripts/with-local-supabase.mjs <comando> [args...]
import { execFileSync, spawnSync } from "node:child_process";

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error("Uso: node scripts/with-local-supabase.mjs <comando> [args...]");
  process.exit(2);
}

const shell = process.platform === "win32";
let status;
try {
  status = JSON.parse(
    execFileSync("npx", ["supabase", "status", "-o", "json"], {
      encoding: "utf8",
      shell,
      stdio: ["ignore", "pipe", "ignore"],
    }),
  );
} catch {
  console.error("Supabase local não está rodando. Execute `npm run db:start`.");
  process.exit(1);
}

const apiUrl = status.API_URL;
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(apiUrl ?? "")) {
  console.error(`Recusado: API_URL não é local (${apiUrl}).`);
  process.exit(1);
}

const result = spawnSync(cmd, args, {
  stdio: "inherit",
  shell,
  env: {
    ...process.env,
    SUPABASE_URL: apiUrl,
    SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY ?? status.ANON_KEY,
  },
});
process.exit(result.status ?? 1);
