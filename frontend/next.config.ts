import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

// Absolute app root (directory containing this file). Next 16 Turbopack can
// otherwise infer `frontend/app` as the root on some setups, breaking resolution.
const turbopackRoot = path.dirname(fileURLToPath(import.meta.url));

const backendUrl = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  turbopack: {
    root: turbopackRoot,
  },
  // Dev rewrites proxy to FastAPI; default proxy timeout is 30s. Multi-image menu
  // parsing (GPT-4o vision) can take 30–90s, which otherwise causes ECONNRESET.
  experimental: {
    proxyTimeout: 120_000,
  },
  allowedDevOrigins: ["10.100.102.11", "localhost", "10.100.102.2", "10.100.102.3", "10.100.102.13"],
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
