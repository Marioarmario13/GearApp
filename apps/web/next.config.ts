import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // @gearhead/shared é consumido como código-fonte TypeScript (sem build próprio).
  transpilePackages: ["@gearhead/shared"],
  experimental: {
    // Upload de fotos via Server Action: 5 MB (limite do bucket) + overhead do multipart.
    serverActions: { bodySizeLimit: "5.5mb" },
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
