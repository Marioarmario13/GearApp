// Copia o worker do MapLibre GL JS (v6, ESM) para public/vendor/.
// O Turbopack não serve o arquivo que a biblioteca resolve sozinha, então o mapa
// usa setWorkerUrl("/vendor/maplibre-gl-worker.mjs"). Roda em predev/prebuild,
// mantendo o worker sempre na mesma versão do pacote instalado (arquivo no .gitignore).
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve("maplibre-gl/package.json"));
const source = join(pkgDir, "dist", "maplibre-gl-worker.mjs");
const targetDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "vendor");

mkdirSync(targetDir, { recursive: true });
copyFileSync(source, join(targetDir, "maplibre-gl-worker.mjs"));
console.log("maplibre-gl-worker.mjs copiado para public/vendor/");
