import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Standard Vercel deployment — no static export.
    // The page is "use client" + fetches GitHub releases at runtime, so there's
    // no server-side API surface and nothing to host beyond static + the Next runtime.
    images: {
        // The page only renders a local logo, but allow github user-content if we
        // ever swap in remote screenshots.
        remotePatterns: [
            { protocol: "https", hostname: "raw.githubusercontent.com" },
            { protocol: "https", hostname: "user-images.githubusercontent.com" },
        ],
    },
};

export default nextConfig;
