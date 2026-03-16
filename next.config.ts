import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  // Required for Tauri: don't use trailing slashes
  trailingSlash: false,
  // Skip API routes (Tauri handles backend)
  distDir: "out",
};

export default nextConfig;
