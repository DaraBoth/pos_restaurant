import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "DineOS — Modern POS for Cambodian Restaurants",
    description:
        "Offline-first Point of Sale for restaurants and cafes. Dual currency USD / KHR, Khmer-ready, GDT-compliant. Free for now to download.",
    metadataBase: new URL("https://dineos.app"),
    icons: {
        icon: [
            { url: "/favicon_io/favicon.ico", sizes: "any" },
            { url: "/favicon_io/favicon-16x16.png", sizes: "16x16", type: "image/png" },
            { url: "/favicon_io/favicon-32x32.png", sizes: "32x32", type: "image/png" },
            { url: "/favicon_io/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
            { url: "/favicon_io/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
        ],
        apple: { url: "/favicon_io/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
        shortcut: "/favicon_io/favicon.ico",
    },
    manifest: "/favicon_io/site.webmanifest",
    alternates: {
        languages: {
            en: "/",
            km: "/km",
        },
    },
    openGraph: {
        title: "DineOS — Modern POS for Cambodian Restaurants",
        description:
            "Offline-first POS for restaurants & cafes. USD + KHR, Khmer, thermal receipts, auto-update.",
        type: "website",
        siteName: "DineOS",
        images: [{ url: "/favicon_io/android-chrome-512x512.png", width: 512, height: 512, alt: "DineOS" }],
    },
    twitter: {
        card: "summary_large_image",
        title: "DineOS — Modern POS for Cambodian Restaurants",
        description:
            "Offline-first POS for restaurants & cafes. USD + KHR, Khmer, thermal receipts, auto-update.",
        images: ["/favicon_io/android-chrome-512x512.png"],
    },
};

export default function RootLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body>{children}</body>
        </html>
    );
}
