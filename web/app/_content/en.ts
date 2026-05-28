import type { LandingContent } from './types';

export const EN: LandingContent = {
    lang: 'en',

    navFeatures: 'Features',
    navScreenshots: 'Screenshots',
    navDownload: 'Download',

    heroBadgePrefix: 'Latest',
    heroTitleTop: 'Modern POS,',
    heroTitleAccent: 'built for Cambodia.',
    heroSubtitle:
        "DineOS is an offline-first Point of Sale for restaurants, cafes, and bars. Dual currency USD & KHR, Khmer language, thermal-printer-ready, with encrypted cloud backup. Free to download today.",
    heroAllDownloads: 'All downloads',
    heroReleasedPrefix: 'Released ',

    featuresEyebrow: 'Why DineOS',
    featuresTitle: 'Built for the floor, not the boardroom.',
    featuresSubtitle:
        "Everything a Cambodian restaurant actually needs — and nothing it doesn't. No subscriptions, no per-seat pricing, no internet required.",

    features: [
        {
            id: 'offline',
            title: 'Offline-First',
            body:
                'Your POS keeps working when the internet drops. Data syncs back to the cloud the moment you reconnect — no lost orders, no panic.',
        },
        {
            id: 'dual-currency',
            title: 'Dual Currency USD + KHR',
            body:
                'Built for Cambodia. Automatic conversion with the GDT/NBC rule (round to the nearest 100 riels) and configurable exchange rate.',
        },
        {
            id: 'bilingual',
            title: 'Khmer & English',
            body:
                'Every product, menu category, and receipt supports both Khmer and English side by side. Thermal-print Khmer receipts out of the box.',
        },
        {
            id: 'thermal',
            title: 'Thermal Receipts',
            body:
                'Works with any USB / LAN / Bluetooth thermal printer (58mm or 80mm). Multiple receipt templates including a Khmer daily-summary report.',
        },
        {
            id: 'secure',
            title: 'Encrypted & Local-First',
            body:
                "Passwords are Argon2-hashed; your business data lives on your device with an encrypted cloud mirror, not on a stranger's server.",
        },
    ],

    shotsEyebrow: 'A look inside',
    shotsTitle: 'Designed to be the fastest part of your shift.',
    shotsSubtitle:
        "Clean, dark, and built for staff who don't have time to think about software.",

    screenshots: [
        { id: 'pos',        label: 'POS',           caption: 'Bilingual menu, dual-currency totals, one tap to send to the kitchen.' },
        { id: 'tables',     label: 'Floor Plan',    caption: 'Visual table map — busy / free at a glance, jump straight into a session.' },
        { id: 'history',    label: 'Order History', caption: 'Filter by date, reprint receipts, export to Excel, print a thermal sales summary.' },
        { id: 'analytics',  label: 'Analytics',     caption: 'Daily revenue, peak hours, top sellers, slow movers — all on one page.' },
        { id: 'management', label: 'Management',    caption: 'Edit menu items, ingredients, tables, and staff without leaving the POS.' },
    ],

    downloadEyebrow: 'Download',
    downloadTitle: 'Free to install. Free to use.',
    downloadSubtitle:
        'Pick your platform below.',
    downloadError: "Couldn't load downloads",
    downloadOpenReleases: 'Try again',
    downloadWindows: {
        title: 'Windows',
        subtitle: 'x64 · MSI installer',
        detail: 'Windows 10 / 11',
    },
    downloadMacIntel: {
        title: 'macOS · Intel',
        subtitle: 'x86_64 · DMG',
        detail: 'macOS 11 or later',
    },
    downloadMacArm: {
        title: 'macOS · Apple Silicon',
        subtitle: 'aarch64 · DMG',
        detail: 'M1 · M2 · M3 · M4',
    },
    downloadNotInRelease: 'Not available yet',
    downloadDownloadVerb: 'Download',
    downloadRetry: 'Retry',

    ctaForWindows: 'Download for Windows',
    ctaForMac: 'Download for macOS',
    ctaLoading: 'Loading…',

    footerBuiltIn: 'Built in Cambodia',

    altLangHref: '/km',
    altLangLabel: 'ខ្មែរ',
};
