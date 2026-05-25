import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "192.168.68.94"],
  experimental: {
    preloadEntriesOnStart: false,
  },
  reactCompiler: true,
  turbopack: { root: __dirname },
};

export default nextConfig;

