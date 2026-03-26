'use client';
import Link from 'next/link';
import { useLanguage } from '@/providers/LanguageProvider';
import { Package, Users, RefreshCw, ClipboardList, Building2, ArrowRight, TrendingUp, Layers, BoxesIcon } from 'lucide-react';
import type { TranslationKey } from '@/lib/i18n';

const QUICK_LINKS: { labelKey: TranslationKey; descKey: TranslationKey; icon: any; color: string }[] = [
    { labelKey: 'analytics',    descKey: 'analyticsDesc',    icon: TrendingUp,    color: '#22c55e' },
    { labelKey: 'products',     descKey: 'productsDesc',     icon: Package,       color: '#0ea5e9' },
    { labelKey: 'categories',   descKey: 'categoriesDesc',   icon: Layers,        color: '#8b5cf6' },
    { labelKey: 'inventory',    descKey: 'inventoryDesc',    icon: BoxesIcon,     color: '#f59e0b' },
    { labelKey: 'users',        descKey: 'staffDesc',        icon: Users,         color: '#a78bfa' },
    { labelKey: 'exchangeRate', descKey: 'exchangeRateDesc', icon: RefreshCw,     color: '#fbbf24' },
    { labelKey: 'orderHistory', descKey: 'orderHistoryDesc', icon: ClipboardList, color: '#f97316' },
    { labelKey: 'settings',     descKey: 'settingsDesc',     icon: Building2,     color: '#f43f5e' },
];

export default function DashboardView() {
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

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {QUICK_LINKS.map(({ labelKey, descKey, icon: Icon, color }) => (
                    <div
                        key={labelKey}
                        className="group flex flex-col p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent-blue)]/35 hover:shadow-lg transition-all"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center"
                                style={{ background: `${color}18`, border: `1px solid ${color}30` }}
                            >
                                <Icon size={18} style={{ color }} strokeWidth={2} />
                            </div>
                        </div>
                        <h2 className={`text-sm font-bold text-[var(--foreground)] mb-1 ${lang === 'km' ? 'khmer' : ''}`}>
                            {t(labelKey)}
                        </h2>
                        <p className={`text-xs text-[var(--text-secondary)] leading-snug line-clamp-2 ${lang === 'km' ? 'khmer' : ''}`}>
                            {t(descKey)}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}
