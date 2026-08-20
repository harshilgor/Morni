import path from "path";
import type { NextConfig } from "next";

const deliverySrc = path.join(__dirname, "../delivery/src");
const founderSrc = path.join(__dirname, "../founder/src");

const nextConfig: NextConfig = {
  // Keep tracing at the monorepo root so sibling extension packages are included,
  // but do not override turbopack.root (that fought Vercel's detected root).
  outputFileTracingRoot: path.join(__dirname, "../.."),
  turbopack: {
    resolveAlias: {
      "@morni/delivery": deliverySrc,
      "@morni/founder": founderSrc,
      // tsconfig paths map react → @types for typechecking sibling apps.
      // Override those for the bundler with relative paths to the real packages
      // (absolute Windows paths are rejected by Turbopack).
      react: "./node_modules/react",
      "react/jsx-runtime": "./node_modules/react/jsx-runtime.js",
      "react/jsx-dev-runtime": "./node_modules/react/jsx-dev-runtime.js",
      "react-dom": "./node_modules/react-dom",
      "react-dom/client": "./node_modules/react-dom/client.js",
      // Founder (and other extension apps) resolve deps from their own folder;
      // pin Motion to the web install so turbopack can find it on Vercel.
      motion: "./node_modules/motion",
      "motion/react": "./node_modules/motion/dist/es/react.mjs",
    },
  },
  experimental: {
    externalDir: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
