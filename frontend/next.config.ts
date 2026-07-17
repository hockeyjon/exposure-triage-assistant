import path from "node:path";
import type { NextConfig } from "next";

// Deploys into a subdirectory, not the domain root — see
// frontend/scripts/deploy.env.example. Applied only for `next build`
// (NODE_ENV=production), so `next dev` still serves at plain
// http://localhost:3000/ instead of 404ing there.
const basePath = process.env.NODE_ENV === "production" ? "/vulnerabilityscanner" : "";

const nextConfig: NextConfig = {
  output: "export",
  // Pins the workspace root to this frontend/ directory. Without this,
  // Turbopack walks up looking for a lockfile and can land on an unrelated
  // one elsewhere on disk (e.g. ~/package-lock.json), which just produces a
  // harmless but noisy "inferred your workspace root" warning.
  turbopack: {
    root: path.join(__dirname),
  },
  basePath,
  // next/image doesn't re-apply basePath to the raw <img src> when
  // unoptimized (only to _next/* assets), so components that reference a
  // public/ image directly need it themselves — see Header.tsx.
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  trailingSlash: true,
  // next/image's optimizer needs a running Node server; static export has
  // none, so ship images as-is.
  images: { unoptimized: true },
};

export default nextConfig;
