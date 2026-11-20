import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // La bandeja de prueba se lee del disco: incluirla en el despliegue (Vercel).
  outputFileTracingIncludes: {
    "/api/ingest": ["./data/bandeja-prueba/**/*"],
  },
  partialPrefetching: true,
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
