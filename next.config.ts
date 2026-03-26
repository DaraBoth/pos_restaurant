import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  // Use trailing slashes so sub-routes export as folder/index.html
  // which Tauri's file protocol resolves more reliably
  trailingSlash: true,

  // Collapse lucide-react (hundreds of icon modules) into a single shared chunk.
  // Without this, navigating to any new route in production triggers loading
  // dozens of tiny icon files over Tauri's file:// protocol, causing visible lag.
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },

  // Prevent Next.js from splitting JS into too many micro-chunks.
  // Each chunk = a separate file:// read in Tauri. Merging them removes
  // the per-file overhead that makes route transitions feel slow.
  webpack: (config) => {
    if (config.optimization?.splitChunks && typeof config.optimization.splitChunks === 'object') {
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        minSize: 40_000,         // only split when chunk would be > 40 KB
        maxInitialRequests: 5,   // max sync chunks per entry-point
        maxAsyncRequests: 8,     // max async (lazy) chunks per split point
      };
    }
    return config;
  },
};

export default nextConfig;
