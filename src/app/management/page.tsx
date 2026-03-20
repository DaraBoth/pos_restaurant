'use client';
import Link from 'next/link';
import { useLanguage } from '@/providers/LanguageProvider';
import { Package, Users, RefreshCw, ClipboardList, Building2, ArrowRight, TrendingUp } from 'lucide-react';
import type { TranslationKey } from '@/lib/i18n';

const QUICK_LINKS: { href: string; labelKey: TranslationKey; descKey: TranslationKey; icon: any; color: string }[] = [
    { href: '/management/analytics', labelKey: 'analytics',    descKey: 'analyticsDesc', icon: TrendingUp, color: '#22c55e' },
    { href: '/management/products',  labelKey: 'products',     descKey: 'productsDesc', icon: Package, color: '#0ea5e9' },
    { href: '/management/users',     labelKey: 'users',        descKey: 'staffDesc', icon: Users, color: '#a78bfa' },
    { href: '/management/exchange-rate', labelKey: 'exchangeRate', descKey: 'exchangeRateDesc', icon: RefreshCw, color: '#fbbf24' },
    { href: '/management/orders',    labelKey: 'orderHistory', descKey: 'orderHistoryDesc', icon: ClipboardList, color: '#f97316' },
    { href: '/management/settings',  labelKey: 'settings',     descKey: 'settingsDesc', icon: Building2, color: '#f43f5e' },
];

export default function ManagementDashboard() {
    const { t, lang } = useLanguage();

    return (
        <div className="animate-fade-in">
            <div className="mb-4">
                <h1 className="text-base font-black text-[var(--foreground)] mb-0.5">
                    {t('management')}
                </h1>
                <p className="text-xs text-[var(--text-secondary)]">
                    {t('manageOperations')}
                </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {QUICK_LINKS.map(({ href, labelKey, descKey, icon: Icon, color }) => (
                    <Link
                        key={href}
                        href={href}
                        className="group flex flex-col p-3.5 rounded-xl transition-all bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent-blue)]/35 hover:shadow-lg hover:-translate-y-0.5 active:scale-95"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center"
                                style={{ background: `${color}18`, border: `1px solid ${color}30` }}
                            >
                                <Icon size={18} style={{ color }} strokeWidth={2} />
                            </div>
                            <ArrowRight size={14} className="text-[var(--text-secondary)] group-hover:text-[var(--accent-blue)] transition-colors mt-1" />
                        </div>
                        <h2 className={`text-sm font-bold text-[var(--foreground)] mb-1 ${lang === 'km' ? 'khmer' : ''}`}>
                            {t(labelKey)}
                        </h2>
                        <p className={`text-xs text-[var(--text-secondary)] leading-snug line-clamp-2 ${lang === 'km' ? 'khmer' : ''}`}>
                            {t(descKey)}
                        </p>
                    </Link>
                ))}
            </div>
        </div>
    );
}
