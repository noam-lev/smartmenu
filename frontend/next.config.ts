import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

// Absolute app root (directory containing this file). Next 16 Turbopack can
// otherwise infer `frontend/app` as the root on some setups, breaking resolution.
const turbopackRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: turbopackRoot,
  },
  allowedDevOrigins: ["10.100.102.11", "localhost", "10.100.102.2", "10.100.102.3", "10.100.102.13"],
};

export default nextConfig;
