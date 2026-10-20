import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // @gearhead/shared é consumido como código-fonte TypeScript (sem build próprio).
  transpilePackages: ["@gearhead/shared"],
  experimental: {
    // Uploads via Server Action: documentos até 10 MB (maior limite de bucket) + overhead do multipart.
    serverActions: { bodySizeLimit: "10.5mb" },
  },
  // Cabeçalhos de segurança para todas as rotas. Geolocalização só para o próprio site
  // (radar e compartilhamento); câmera e microfone desligados.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "geolocation=(self), camera=(), microphone=(), payment=()",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
          },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
