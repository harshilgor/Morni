import path from "path";
import type { NextConfig } from "next";

const repoRoot = path.join(__dirname, "../..");
const deliverySrc = path.join(__dirname, "../delivery/src");
const founderSrc = path.join(__dirname, "../founder/src");

const nextConfig: NextConfig = {
  // Match Vercel outputFileTracingRoot (repo root) so sibling extension apps resolve.
  outputFileTracingRoot: repoRoot,
  turbopack: {
    root: repoRoot,
    resolveAlias: {
      "@morni/delivery": deliverySrc,
      "@morni/founder": founderSrc,
      "@": path.join(__dirname, "src"),
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
