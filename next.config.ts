import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_JAPANESE_LAB_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  basePath: basePath || undefined,
  serverExternalPackages: ["archiver", "pg"],
  experimental: { cpus: 1, webpackMemoryOptimizations: true, webpackBuildWorker: true },
};

export default nextConfig;
