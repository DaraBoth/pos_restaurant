'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
    Download, ShieldCheck, WifiOff, Coins, Languages,
    Receipt, RefreshCw, Apple, Monitor, ChevronRight, Tag,
} from 'lucide-react';
import type { LandingContent, FeatureId, ShotId } from '@/app/_content/types';

// Release data is fetched server-side in app/page.tsx (and app/km/page.tsx)
// via _lib/release.ts so the GIT_TOKEN never leaves the server. We re-declare
// the shapes here for prop typing; we never call the API directly.
interface GithubAsset {
    name: string;
    browser_download_url: string;
    size: number;
    content_type: string;
}

interface GithubRelease {
    tag_name: string;
    name: string;
    published_at: string;
    body: string;
    html_url: string;
    assets: GithubAsset[];
}

type DetectedOS = 'windows' | 'mac-intel' | 'mac-arm' | 'other';

function detectOs(): DetectedOS {
    if (typeof navigator === 'undefined') return 'other';
    const platform = (navigator.platform || '').toLowerCase();
    const ua = navigator.userAgent.toLowerCase();
    if (platform.startsWith('win') || ua.includes('windows')) return 'windows';
    if (platform.startsWith('mac') || ua.includes('mac')) return 'mac-intel';
    return 'other';
}

function pickWindows(assets: GithubAsset[]): GithubAsset | null {
    return (
        assets.find(a => a.name.toLowerCase().endsWith('.msi')) ||
        assets.find(a => /setup\.exe$/i.test(a.name)) ||
        assets.find(a => a.name.toLowerCase().endsWith('.exe')) ||
        null
    );
}
function pickMacIntel(assets: GithubAsset[]): GithubAsset | null {
    return (
        assets.find(a => a.name.toLowerCase().endsWith('.dmg') && /(x64|x86_64|intel)/i.test(a.name)) ||
        assets.find(a => a.name.toLowerCase().endsWith('.dmg') && !/aarch64|arm64|apple-silicon/i.test(a.name)) ||
        null
    );
}
function pickMacArm(assets: GithubAsset[]): GithubAsset | null {
    return assets.find(a => a.name.toLowerCase().endsWith('.dmg') && /(aarch64|arm64|apple-silicon)/i.test(a.name)) || null;
}

function formatSize(bytes: number): string {
    const mb = bytes / 1024 / 1024;
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}
function formatDate(iso: string, lang: 'en' | 'km'): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString(lang === 'km' ? 'km-KH' : 'en-US', {
        day: '2-digit', month: 'short', year: 'numeric',
    });
}

// ── Visual config (icons + accent colors per feature/screenshot, NOT translatable) ──
const FEATURE_ICONS: Record<FeatureId, { icon: typeof WifiOff; accent: string }> = {
    'offline':       { icon: WifiOff,    accent: 'text-emerald-400' },
    'dual-currency': { icon: Coins,      accent: 'text-yellow-400' },
    'bilingual':     { icon: Languages,  accent: 'text-blue-400' },
    'thermal':       { icon: Receipt,    accent: 'text-purple-400' },
    'secure':        { icon: ShieldCheck, accent: 'text-cyan-400' },
};

const SHOT_SOURCES: Record<ShotId, string> = {
    pos:        '/screenshots/product_page_withorder.png',
    tables:     '/screenshots/table_page.png',
    history:    '/screenshots/order_history_page.png',
    analytics:  '/screenshots/admin_Analyst_page.png',
    management: '/screenshots/admin_updateProduct_slide.png',
};

interface LandingPageProps {
    content: LandingContent;
    /** Latest release fetched server-side. Null when the SSR fetch failed. */
    initialRelease: GithubRelease | null;
}

export default function LandingPage({ content: t, initialRelease }: LandingPageProps) {
    // Server already did the fetch. There's no client-side loading state.
    const release = initialRelease;
    const loading = false;
    const error: string | null = release ? null : 'Could not load downloads from GitHub.';
    const [os, setOs] = useState<DetectedOS>('other');
    const [activeShotId, setActiveShotId] = useState<ShotId>('pos');
    const activeShot = t.screenshots.find(s => s.id === activeShotId) ?? t.screenshots[0];

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOs(detectOs());
    }, []);

    const windows = useMemo(() => (release ? pickWindows(release.assets) : null), [release]);
    const macIntel = useMemo(() => (release ? pickMacIntel(release.assets) : null), [release]);
    const macArm = useMemo(() => (release ? pickMacArm(release.assets) : null), [release]);

    const version = release?.tag_name?.replace(/^v/, '') || '';
    const publishedAt = release ? formatDate(release.published_at, t.lang) : '';

    return (
        <main className="min-h-screen">
            {/* ── Nav ── */}
            <nav className="sticky top-0 z-40 backdrop-blur-md bg-[var(--bg-dark)]/75 border-b border-[var(--border)]">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <a href="#top" className="flex items-center gap-2.5 group">
                        <Image src="/logo.png" alt="DineOS logo" width={36} height={36} className="w-9 h-9 rounded-xl object-cover" priority />
                        <span className="font-black tracking-tight text-lg">DineOS</span>
                    </a>
                    <div className="flex items-center gap-2 sm:gap-4 text-sm">
                        <a href="#features" className="hidden sm:inline text-[var(--text-secondary)] hover:text-white transition-colors">{t.navFeatures}</a>
                        <a href="#screenshots" className="hidden sm:inline text-[var(--text-secondary)] hover:text-white transition-colors">{t.navScreenshots}</a>
                        <a href="#download" className="hidden sm:inline text-[var(--text-secondary)] hover:text-white transition-colors">{t.navDownload}</a>
                        <Link
                            href={t.altLangHref}
                            className="px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-white hover:border-white/20 transition-colors text-xs font-black tracking-widest"
                            aria-label={`Switch to ${t.altLangLabel}`}
                        >
                            {t.altLangLabel}
                        </Link>
                    </div>
                </div>
            </nav>

            {/* ── Hero ── */}
            <section id="top" className="hero-grid">
                <div className="max-w-6xl mx-auto px-6 pt-20 pb-24 sm:pt-28 sm:pb-32">
                    {version && (
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-black uppercase tracking-widest mb-6 float-up">
                            <Tag size={11} /> {t.heroBadgePrefix} · v{version}
                        </div>
                    )}
                    <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.05] mb-5 float-up" style={{ animationDelay: '60ms' }}>
                        {t.heroTitleTop}
                        <br />
                        <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-emerald-500 bg-clip-text text-transparent">
                            {t.heroTitleAccent}
                        </span>
                    </h1>
                    <p className="text-base sm:text-lg text-[var(--text-secondary)] max-w-2xl mb-10 leading-relaxed float-up" style={{ animationDelay: '120ms' }}>
                        {t.heroSubtitle}
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3 max-w-xl float-up" style={{ animationDelay: '180ms' }}>
                        <PrimaryDownloadButton
                            os={os}
                            windows={windows}
                            macIntel={macIntel}
                            macArm={macArm}
                            loading={loading}
                            error={error}
                            t={t}
                        />
                        <a href="#download" className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl border border-[var(--border)] hover:bg-white/5 transition-colors text-sm font-bold">
                            {t.heroAllDownloads} <ChevronRight size={16} />
                        </a>
                    </div>

                    {publishedAt && (
                        <p className="text-xs text-[var(--text-secondary)]/60 mt-5">
                            {t.heroReleasedPrefix}{publishedAt}
                        </p>
                    )}
                </div>
            </section>

            {/* ── Features ── */}
            <section id="features" className="border-t border-[var(--border)]">
                <div className="max-w-6xl mx-auto px-6 py-20 sm:py-24">
                    <div className="text-center mb-14 max-w-2xl mx-auto">
                        <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-400 mb-3">{t.featuresEyebrow}</p>
                        <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">{t.featuresTitle}</h2>
                        <p className="text-[var(--text-secondary)] leading-relaxed">{t.featuresSubtitle}</p>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {t.features.map((f, i) => {
                            const meta = FEATURE_ICONS[f.id];
                            const Icon = meta.icon;
                            return (
                                <div
                                    key={f.id}
                                    className="group relative rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 hover:border-white/15 hover:bg-[var(--bg-elevated)] transition-all float-up"
                                    style={{ animationDelay: `${i * 60}ms` }}
                                >
                                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${meta.accent} bg-white/5 border border-white/5 group-hover:scale-110 transition-transform`}>
                                        <Icon size={20} />
                                    </div>
                                    <h3 className="text-base font-black mb-2">{f.title}</h3>
                                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{f.body}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ── Screenshots ── */}
            <section id="screenshots" className="border-t border-[var(--border)] bg-[var(--bg-card)]/40">
                <div className="max-w-6xl mx-auto px-6 py-20 sm:py-24">
                    <div className="text-center mb-12 max-w-2xl mx-auto">
                        <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-400 mb-3">{t.shotsEyebrow}</p>
                        <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">{t.shotsTitle}</h2>
                        <p className="text-[var(--text-secondary)] leading-relaxed">{t.shotsSubtitle}</p>
                    </div>

                    <div className="flex flex-wrap justify-center gap-2 mb-8" role="tablist">
                        {t.screenshots.map(s => {
                            const isActive = s.id === activeShot.id;
                            return (
                                <button
                                    key={s.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={isActive}
                                    onClick={() => setActiveShotId(s.id)}
                                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border ${
                                        isActive
                                            ? 'bg-emerald-500 border-emerald-400 text-black shadow-lg shadow-emerald-500/20'
                                            : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-secondary)] hover:text-white hover:border-white/15'
                                    }`}
                                >
                                    {s.label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden shadow-2xl shadow-black/40">
                        <div className="px-4 py-3 flex items-center gap-1.5 border-b border-[var(--border)] bg-[var(--bg-elevated)]">
                            <span className="w-3 h-3 rounded-full bg-red-500/70" />
                            <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
                            <span className="w-3 h-3 rounded-full bg-emerald-500/70" />
                            <span className="ml-3 text-[10px] font-mono opacity-50 tracking-wide">DineOS · {activeShot.label}</span>
                        </div>
                        <div className="relative w-full bg-black" style={{ aspectRatio: '16 / 10' }}>
                            <Image
                                key={activeShot.id}
                                src={SHOT_SOURCES[activeShot.id]}
                                alt={`DineOS ${activeShot.label} screenshot`}
                                fill
                                sizes="(max-width: 1024px) 100vw, 1024px"
                                className="object-contain"
                                priority={activeShot.id === 'pos'}
                            />
                        </div>
                    </div>
                    <p className="text-center text-sm text-[var(--text-secondary)] mt-5 max-w-xl mx-auto">{activeShot.caption}</p>
                </div>
            </section>

            {/* ── Downloads ── */}
            <section id="download" className="border-t border-[var(--border)]">
                <div className="max-w-6xl mx-auto px-6 py-20 sm:py-24">
                    <div className="text-center mb-12 max-w-2xl mx-auto">
                        <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-400 mb-3">{t.downloadEyebrow}</p>
                        <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">{t.downloadTitle}</h2>
                        <p className="text-[var(--text-secondary)] leading-relaxed">{t.downloadSubtitle}</p>
                    </div>

                    {loading && <DownloadSkeleton />}

                    {!loading && error && (
                        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 max-w-xl mx-auto text-center">
                            <p className="text-amber-300 font-black mb-2">{t.downloadError}</p>
                            <p className="text-sm text-amber-200/80 mb-4">{error}</p>
                            <button
                                type="button"
                                onClick={() => { if (typeof window !== 'undefined') window.location.reload(); }}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-sm font-bold transition-colors"
                            >
                                {t.downloadRetry} <ChevronRight size={14} />
                            </button>
                        </div>
                    )}

                    {!loading && !error && release && (
                        <div className="grid sm:grid-cols-3 gap-4 max-w-5xl mx-auto">
                            <DownloadCard t={t} card={t.downloadWindows} icon={Monitor} asset={windows} accent="from-blue-400/80 to-blue-600/80" />
                            <DownloadCard t={t} card={t.downloadMacIntel} icon={Apple} asset={macIntel} accent="from-zinc-400/80 to-zinc-600/80" />
                            <DownloadCard t={t} card={t.downloadMacArm} icon={Apple} asset={macArm} accent="from-purple-400/80 to-purple-600/80" />
                        </div>
                    )}

                </div>
            </section>

            {/* ── Footer ── */}
            <footer className="border-t border-[var(--border)]">
                <div className="max-w-6xl mx-auto px-6 py-10 flex items-center justify-center gap-3 text-center">
                    <Image src="/logo.png" alt="DineOS logo" width={28} height={28} className="w-7 h-7 rounded-lg object-cover" />
                    <span className="text-sm font-black tracking-tight">DineOS</span>
                    <span className="text-xs text-[var(--text-secondary)]/60">
                        © {new Date().getFullYear()} · {t.footerBuiltIn}
                    </span>
                </div>
            </footer>
        </main>
    );
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function PrimaryDownloadButton({
    os, windows, macIntel, macArm, loading, error, t,
}: {
    os: DetectedOS;
    windows: GithubAsset | null;
    macIntel: GithubAsset | null;
    macArm: GithubAsset | null;
    loading: boolean;
    error: string | null;
    t: LandingContent;
}) {
    if (loading) {
        return (
            <button disabled className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-emerald-500/30 text-white/60 text-sm font-black tracking-widest uppercase">
                <RefreshCw size={16} className="animate-spin" />
                {t.ctaLoading}
            </button>
        );
    }
    if (error) {
        return (
            <button
                type="button"
                onClick={() => { if (typeof window !== 'undefined') window.location.reload(); }}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-white/5 border border-[var(--border)] text-sm font-black tracking-widest uppercase hover:bg-white/10 transition-colors"
            >
                <RefreshCw size={16} /> {t.downloadRetry}
            </button>
        );
    }

    let asset: GithubAsset | null = null;
    let label = t.ctaForWindows;
    let Icon = Download;
    if (os === 'windows' && windows) {
        asset = windows;
        label = t.ctaForWindows;
        Icon = Monitor;
    } else if ((os === 'mac-intel' || os === 'mac-arm') && (macArm || macIntel)) {
        asset = macArm ?? macIntel;
        label = t.ctaForMac;
        Icon = Apple;
    } else if (windows) {
        asset = windows;
        label = t.ctaForWindows;
        Icon = Monitor;
    }

    if (!asset) {
        return (
            <a href="#download" className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-black tracking-widest uppercase transition-colors">
                <Download size={16} /> {t.heroAllDownloads}
            </a>
        );
    }

    return (
        <a href={asset.browser_download_url} className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-black tracking-widest uppercase shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]">
            <Icon size={16} strokeWidth={2.5} />
            {label}
            <span className="opacity-60 font-mono text-[10px] ml-1">{formatSize(asset.size)}</span>
        </a>
    );
}

function DownloadCard({
    t, card, icon: Icon, asset, accent,
}: {
    t: LandingContent;
    card: { title: string; subtitle: string; detail: string };
    icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
    asset: GithubAsset | null;
    accent: string;
}) {
    const disabled = !asset;
    return (
        <div className={`rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 flex flex-col ${disabled ? 'opacity-50' : 'hover:border-white/15 hover:bg-[var(--bg-elevated)]'} transition-all`}>
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center text-white mb-4`}>
                <Icon size={22} strokeWidth={2.5} />
            </div>
            <h3 className="text-lg font-black mb-1">{card.title}</h3>
            <p className="text-xs text-[var(--text-secondary)] mb-1 uppercase tracking-widest font-bold">{card.subtitle}</p>
            <p className="text-xs text-[var(--text-secondary)]/70 mb-5">{card.detail}</p>

            {asset ? (
                <a href={asset.browser_download_url} className="mt-auto flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white text-black text-sm font-black uppercase tracking-widest hover:bg-emerald-300 transition-colors active:scale-[0.98]">
                    <Download size={15} strokeWidth={2.5} />
                    {t.downloadDownloadVerb}
                    <span className="font-mono text-[10px] opacity-50 ml-1">{formatSize(asset.size)}</span>
                </a>
            ) : (
                <div className="mt-auto px-4 py-3 rounded-xl bg-white/5 text-[var(--text-secondary)] text-xs font-bold uppercase tracking-widest text-center">
                    {t.downloadNotInRelease}
                </div>
            )}
        </div>
    );
}

function DownloadSkeleton() {
    return (
        <div className="grid sm:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {[0, 1, 2].map(i => (
                <div key={i} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 h-56 pulse-slow">
                    <div className="w-12 h-12 rounded-xl bg-white/5 mb-4" />
                    <div className="w-2/3 h-5 bg-white/5 rounded mb-2" />
                    <div className="w-1/2 h-3 bg-white/5 rounded mb-1" />
                    <div className="w-1/3 h-3 bg-white/5 rounded mb-6" />
                    <div className="w-full h-10 bg-white/5 rounded-xl" />
                </div>
            ))}
        </div>
    );
}
