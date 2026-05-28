// Shared content shape used by both /en (root) and /km landing pages.
// Adding a new language = adding a new file that satisfies this interface.

export type ShotId = 'pos' | 'tables' | 'history' | 'analytics' | 'management';
export type FeatureId =
    | 'offline'
    | 'dual-currency'
    | 'bilingual'
    | 'thermal'
    | 'auto-update'
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
    heroReleasedSuffix: string;          // " · Pulled live from GitHub Releases"

    // Features section
    featuresEyebrow: string;
    featuresTitle: string;
    featuresSubtitle: string;
    features: FeatureContent[];          // exactly 6 entries, fixed order: offline, dual-currency, bilingual, thermal, auto-update, secure

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
    downloadWhatsNew: string;            // "See what's new in" / "មើល​អ្វី​ថ្មី​នៅ"
    downloadDownloadVerb: string;        // "Download" CTA on each card

    // Primary hero CTA labels
    ctaForWindows: string;
    ctaForMac: string;
    ctaOpenReleases: string;
    ctaGetOnGithub: string;
    ctaLoading: string;

    // Footer
    footerBuiltIn: string;               // "Built in Cambodia"
    footerSource: string;
    footerReleases: string;

    // Language switcher
    altLangHref: '/' | '/km';
    altLangLabel: string;                // label of the OTHER language
}
