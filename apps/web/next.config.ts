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
