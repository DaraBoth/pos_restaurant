import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  // Use trailing slashes so sub-routes export as folder/index.html
  // which Tauri's file protocol resolves more reliably
  trailingSlash: true,
};

export default nextConfig;
