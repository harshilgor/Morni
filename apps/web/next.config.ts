import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Include sibling extension apps (delivery, founder) in Turbopack's resolve root.
  turbopack: {
    root: path.join(__dirname, ".."),
    resolveAlias: {
      "@morni/delivery": path.join(__dirname, "../delivery/src"),
      "@morni/founder": path.join(__dirname, "../founder/src"),
      "@": path.join(__dirname, "src"),
    },
  },
  // Allow apps/web to mount extension UI from apps/delivery and apps/founder.
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
