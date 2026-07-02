'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/providers/LanguageProvider';
import { useAuth } from '@/providers/AuthProvider';
import {
    Package, Users, ClipboardList, Building2, TrendingUp, Layers, BoxesIcon,
    ArrowLeftRight, DollarSign, ShoppingCart, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import type { TranslationKey } from '@/lib/i18n';
import type { RevenueSummary, InventoryItem, ExchangeRate } from '@/types';
import { getRevenueSummary } from '@/lib/api/analytics';
import { getInventoryItems } from '@/lib/api/inventory';
import { getExchangeRate } from '@/lib/api/system';

type QuickLink =
    | { labelKey: TranslationKey; descKey: TranslationKey; icon: React.ElementType; color: string; tab: string; href?: never }
    | { labelKey: TranslationKey; descKey: TranslationKey; icon: React.ElementType; color: string; href: string; tab?: never };

const QUICK_LINKS: QuickLink[] = [
    { labelKey: 'analytics',    descKey: 'analyticsDesc',    icon: TrendingUp,       color: '#22c55e', tab: 'analytics' },
    { labelKey: 'products',     descKey: 'productsDesc',     icon: Package,          color: '#0ea5e9', tab: 'products' },
    { labelKey: 'categories',   descKey: 'categoriesDesc',   icon: Layers,           color: '#8b5cf6', tab: 'categories' },
    { labelKey: 'inventory',    descKey: 'inventoryDesc',    icon: BoxesIcon,        color: '#f59e0b', tab: 'inventory' },
    { labelKey: 'users',        descKey: 'staffDesc',        icon: Users,            color: '#a78bfa', tab: 'users' },
    { labelKey: 'exchangeRate', descKey: 'exchangeRateDesc', icon: ArrowLeftRight,   color: '#fbbf24', href: '/settings/business/exchange-rate' },
    { labelKey: 'orderHistory', descKey: 'orderHistoryDesc', icon: ClipboardList,    color: '#f97316', tab: 'orders' },
    { labelKey: 'settings',     descKey: 'settingsDesc',     icon: Building2,        color: '#f43f5e', href: '/management/settings' },
];

export default function DashboardView() {
    const { t, lang } = useLanguage();
    const { user } = useAuth();

    const [summary, setSummary] = useState<RevenueSummary | null>(null);
    const [rate, setRate] = useState<ExchangeRate | null>(null);
    const [lowItems, setLowItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const rid = user?.restaurant_id || undefined;
        Promise.all([
            getRevenueSummary(rid),
            rid ? getExchangeRate(rid) : Promise.resolve(null),
            getInventoryItems(rid),
        ]).then(([s, r, inv]) => {
            setSummary(s);
            setRate(r);
            setLowItems((inv ?? []).filter(i => i.stock_qty <= i.min_stock_qty));
        }).catch(() => {
            // silently degrade — KPIs will remain null
        }).finally(() => setLoading(false));
    }, [user?.restaurant_id]);

    const kpiSkeleton = <span className="inline-block h-4 w-12 rounded bg-[var(--bg-elevated)] animate-pulse" />;

    return (
        <div className="animate-fade-in space-y-5">
            <div>
                <h1 className="text-base font-black text-[var(--foreground)] mb-0.5">{t('management')}</h1>
                <p className="text-xs text-[var(--text-secondary)]">{t('manageOperations')}</p>
            </div>

            {/* KPI strip */}
            <div className="grid grid-cols-3 gap-3">
                {/* Today revenue */}
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20 flex-shrink-0">
                        <DollarSign size={16} className="text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">{t('todayRevenue')}</p>
                        <p className="text-sm font-black text-[var(--foreground)]">
                            {loading ? kpiSkeleton : summary ? `$${(summary.today_usd / 100).toFixed(2)}` : '—'}
                        </p>
                    </div>
                </div>

                {/* Today orders */}
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-sky-500/10 border border-sky-500/20 flex-shrink-0">
                        <ShoppingCart size={15} className="text-sky-400" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">{t('orders')}</p>
                        <p className="text-sm font-black text-[var(--foreground)]">
                            {loading ? kpiSkeleton : summary ? summary.today_orders : '—'}
                        </p>
                    </div>
                </div>

                {/* Exchange rate */}
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-amber-500/10 border border-amber-500/20 flex-shrink-0">
                        <ArrowLeftRight size={14} className="text-amber-400" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">{t('exchangeRate')}</p>
                        <p className="text-sm font-black text-[var(--foreground)]">
                            {loading ? kpiSkeleton : rate ? `${Math.round(rate.rate).toLocaleString()} ៛` : '—'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Low-stock alert */}
            {!loading && (
                <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${lowItems.length > 0 ? 'bg-amber-500/5 border-amber-500/25' : 'bg-[var(--bg-card)] border-[var(--border)]'}`}>
                    {lowItems.length > 0 ? (
                        <>
                            <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <p className={`text-xs font-black text-amber-400 mb-0.5 ${lang === 'km' ? 'khmer' : ''}`}>{t('lowStock')} — {lowItems.length} {t('items')}</p>
                                <p className={`text-[11px] text-[var(--text-secondary)] truncate ${lang === 'km' ? 'khmer' : ''}`}>
                                    {lowItems.slice(0, 3).map(i => i.name).join(', ')}{lowItems.length > 3 ? ` +${lowItems.length - 3}` : ''}
                                </p>
                            </div>
                            <Link href="?tab=inventory" className={`text-[10px] font-black text-amber-400 hover:text-amber-300 whitespace-nowrap ${lang === 'km' ? 'khmer' : ''}`}>
                                {t('viewInventory')}
                            </Link>
                        </>
                    ) : (
                        <>
                            <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                            <p className={`text-xs text-[var(--text-secondary)] ${lang === 'km' ? 'khmer' : ''}`}>{t('noLowStockItems')}</p>
                        </>
                    )}
                </div>
            )}

            {/* Quick links grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {QUICK_LINKS.map(({ labelKey, descKey, icon: Icon, color, tab, href }) => (
                    <Link
                        key={labelKey}
                        href={href ?? `?tab=${tab}`}
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
                    </Link>
                ))}
            </div>
        </div>
    );
}
