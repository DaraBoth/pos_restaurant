// Shared content shape used by both /en (root) and /km landing pages.
// Adding a new language = adding a new file that satisfies this interface.

export type ShotId = 'pos' | 'tables' | 'history' | 'analytics' | 'management';
export type FeatureId =
    | 'offline'
    | 'dual-currency'
    | 'bilingual'
    | 'thermal'
    | 'secure';

export interface FeatureContent {
    id: FeatureId;
    title: string;
    body: string;
}

export interface ShotContent {
    id: ShotId;
    label: string;
    caption: string;
}

export interface DownloadCardContent {
    title: string;
    subtitle: string;
    detail: string;
}

export interface LandingContent {
    /** ISO language code — used for the <html lang="..."> attribute on the page route. */
    lang: 'en' | 'km';

    // Nav
    navFeatures: string;
    navScreenshots: string;
    navDownload: string;

    // Hero
    heroBadgePrefix: string;             // "Latest" / "ថ្មីបំផុត"
    heroTitleTop: string;                // "Modern POS,"
    heroTitleAccent: string;             // "built for Cambodia."
    heroSubtitle: string;
    heroAllDownloads: string;
    heroReleasedPrefix: string;          // "Released " / "ចេញផ្សាយ "

    // Features section
    featuresEyebrow: string;
    featuresTitle: string;
    featuresSubtitle: string;
    features: FeatureContent[];          // exactly 5 entries, fixed order: offline, dual-currency, bilingual, thermal, secure

    // Screenshots section
    shotsEyebrow: string;
    shotsTitle: string;
    shotsSubtitle: string;
    screenshots: ShotContent[];          // exactly 5 entries

    // Downloads section
    downloadEyebrow: string;
    downloadTitle: string;
    downloadSubtitle: string;
    downloadError: string;
    downloadOpenReleases: string;
    downloadWindows: DownloadCardContent;
    downloadMacIntel: DownloadCardContent;
    downloadMacArm: DownloadCardContent;
    downloadNotInRelease: string;
    downloadDownloadVerb: string;        // "Download" CTA on each card
    downloadRetry: string;               // generic retry label shown when fetch fails

    // Primary hero CTA labels
    ctaForWindows: string;
    ctaForMac: string;
    ctaLoading: string;

    // Footer
    footerBuiltIn: string;               // "Built in Cambodia"

    // Language switcher
    altLangHref: '/' | '/km';
    altLangLabel: string;                // label of the OTHER language
}
