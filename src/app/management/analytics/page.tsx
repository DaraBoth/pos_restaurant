'use client';
import { useEffect, useState } from 'react';
import { getRevenueSummary, getRevenueByPeriod, RevenueSummary, RevenueByDay } from '@/lib/tauri-commands';
import { getTopProducts, getRevenueByCategory, getPeakHours, getSlowMovers } from '@/lib/api/analytics';
import type { TopProduct, CategoryRevenue, PeakHour } from '@/types';
import { useLanguage } from '@/providers/LanguageProvider';
import { formatUsd } from '@/lib/currency';
import { TrendingUp, ShoppingBag, DollarSign, Clock, AlertTriangle, Flame, PieChart } from 'lucide-react';
import type { TranslationKey } from '@/lib/i18n';

type Period = 'week' | 'month' | '3months' | 'year';

const PERIOD_LABELS: Record<Period, TranslationKey> = {
    week: 'last7Days',
    month: 'thisMonth',
    '3months': 'last3Months',
    year: 'thisYear',
};

export default function AnalyticsPage() {
    const { t, lang } = useLanguage();
    const [summary, setSummary] = useState<RevenueSummary | null>(null);
    const [chartData, setChartData] = useState<RevenueByDay[]>([]);
    
    // Advanced Analytics States
    const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
    const [categoryRevenue, setCategoryRevenue] = useState<CategoryRevenue[]>([]);
    const [peakHours, setPeakHours] = useState<PeakHour[]>([]);
    const [slowMovers, setSlowMovers] = useState<TopProduct[]>([]);

    const [period, setPeriod] = useState<Period>('month');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        async function load() {
            setLoading(true);
            setError('');
            try {
                const [s, d, tp, cr, ph, sm] = await Promise.all([
                    getRevenueSummary(),
                    getRevenueByPeriod(period),
                    getTopProducts(period),
                    getRevenueByCategory(period),
                    getPeakHours(period),
                    getSlowMovers()
                ]);
                setSummary(s);
                setChartData(d);
                setTopProducts(tp);
                setCategoryRevenue(cr);
                setPeakHours(ph);
                setSlowMovers(sm);
            } catch (e) {
                setError(t('analyticsUnavailable'));
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [period, t]);

    const maxRevenue = chartData.length > 0 ? Math.max(...chartData.map(d => d.total_usd)) : 1;

    const statCards = summary ? [
        {
            label: t('todayRevenue'),
            value: formatUsd(summary.today_usd),
            sub: `${summary.today_orders} ${t('orders')}`,
            icon: DollarSign,
            color: 'text-green-400',
            bg: 'bg-green-500/10 border-green-500/20',
        },
        {
            label: t('monthRevenue'),
            value: formatUsd(summary.month_usd),
            sub: `${summary.month_orders} ${t('orders')}`,
            icon: TrendingUp,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10 border-blue-500/20',
        },
        {
            label: t('yearRevenue'),
            value: formatUsd(summary.year_usd),
            sub: `${summary.year_orders} ${t('orders')}`,
            icon: ShoppingBag,
            color: 'text-purple-400',
            bg: 'bg-purple-500/10 border-purple-500/20',
        },
        {
            label: t('openOrders'),
            value: String(summary.open_orders),
            sub: t('activeNow'),
            icon: Clock,
            color: 'text-orange-400',
            bg: 'bg-orange-500/10 border-orange-500/20',
        },
    ] : [];

    return (
        <div className="space-y-4">
            {/* Page header */}
            <div>
                <h1 className="text-base font-black text-[var(--foreground)]">
                    {t('revenueReport')}
                </h1>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {t('revenueOverview')}
                </p>
            </div>

            {error && (
                <div className="pos-card p-4 text-center text-xs text-[var(--text-secondary)]">{error}</div>
            )}

            {loading && !error && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[1,2,3,4].map(i => (
                        <div key={i} className="pos-card p-4 animate-pulse h-24" />
                    ))}
                </div>
            )}

            {!loading && !error && summary && (
                <>
                    {/* Stat Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {statCards.map((card, i) => (
                            <div key={i} className={`pos-card p-3.5 border ${card.bg}`}>
                                <div className="flex items-start justify-between mb-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-secondary)]">{card.label}</p>
                                    <card.icon size={14} className={card.color} />
                                </div>
                                <p className={`text-xl font-black font-mono ${card.color} leading-none`}>{card.value}</p>
                                <p className="text-[10px] text-[var(--text-secondary)] mt-1">{card.sub}</p>
                            </div>
                        ))}
                    </div>

                    {/* Chart section */}
                    <div className="pos-card p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-bold text-[var(--foreground)]">
                                {t('revenueChart')}
                            </h2>
                            <div className="flex items-center gap-1">
                                {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
                                    <button
                                        key={p}
                                        onClick={() => setPeriod(p)}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                                            period === p
                                                ? 'bg-[var(--accent-blue)] text-white'
                                                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] border border-[var(--border)]'
                                        }`}
                                    >
                                        {t(PERIOD_LABELS[p])}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {chartData.length === 0 ? (
                            <div className="h-32 flex items-center justify-center">
                                <p className="text-xs text-[var(--text-secondary)]">
                                    {t('noRevenueData')}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {/* Bar chart */}
                                <div className="flex items-end gap-1 h-32">
                                    {chartData.map((day, i) => {
                                        const height = maxRevenue > 0 ? (day.total_usd / maxRevenue) * 100 : 0;
                                        return (
                                            <div
                                                key={day.date}
                                                className="flex-1 flex flex-col items-center gap-1 group"
                                                title={`${day.date}: ${formatUsd(day.total_usd)} (${day.order_count} ${t('orders')})`}
                                            >
                                                <div className="w-full flex flex-col justify-end" style={{ height: '6rem' }}>
                                                    <div
                                                        className="w-full rounded-t-md bg-[var(--accent-blue)] group-hover:bg-[var(--accent-green)] transition-colors"
                                                        style={{ height: `${Math.max(height, 2)}%`, minHeight: '3px' }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {/* Labels */}
                                <div className="flex gap-1">
                                    {chartData.map(day => {
                                        const d = new Date(day.date);
                                        const label = chartData.length <= 14
                                            ? `${d.getMonth()+1}/${d.getDate()}`
                                            : `${d.getMonth()+1}/${d.getDate()}`;
                                        return (
                                            <div key={day.date} className="flex-1 text-center text-[9px] text-[var(--text-secondary)] truncate">
                                                {label}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Summary row */}
                                <div className="pt-2 border-t border-[var(--border)] flex items-center gap-6 text-xs">
                                    <div>
                                        <span className="text-[var(--text-secondary)]">{t('total')}: </span>
                                        <span className="font-bold font-mono text-green-400">
                                            {formatUsd(chartData.reduce((s, d) => s + d.total_usd, 0))}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[var(--text-secondary)]">{t('orders')}: </span>
                                        <span className="font-bold text-blue-400">
                                            {chartData.reduce((s, d) => s + d.order_count, 0)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Advanced Analytics Widgets */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        
                        {/* Top Products Widget */}
                        <div className="pos-card p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Flame size={18} className="text-orange-400" />
                                <h3 className="text-sm font-black text-[var(--foreground)] uppercase tracking-widest">
                                    Top Products
                                </h3>
                            </div>
                            <div className="space-y-2">
                                {topProducts.slice(0, 5).map((p, i) => (
                                    <div key={p.id} className="flex items-center justify-between p-3 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border)]">
                                        <div className="flex items-center gap-3">
                                            <div className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 font-black text-xs flex items-center justify-center">
                                                {i + 1}
                                            </div>
                                            <div className="font-bold text-sm text-[var(--foreground)]">{p.name}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-mono font-bold text-green-400">{formatUsd(p.total_revenue)}</div>
                                            <div className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">{p.order_count} Sold</div>
                                        </div>
                                    </div>
                                ))}
                                {topProducts.length === 0 && <div className="text-xs text-[var(--text-secondary)] text-center py-4">No data</div>}
                            </div>
                        </div>

                        {/* Revenue by Category Widget */}
                        <div className="pos-card p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <PieChart size={18} className="text-blue-400" />
                                <h3 className="text-sm font-black text-[var(--foreground)] uppercase tracking-widest">
                                    Revenue By Category
                                </h3>
                            </div>
                            <div className="space-y-2">
                                {categoryRevenue.map((c) => (
                                    <div key={c.id} className="flex items-center justify-between p-3 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border)]">
                                        <div className="font-bold text-sm text-[var(--foreground)]">{c.name}</div>
                                        <div className="font-mono font-bold text-blue-400">{formatUsd(c.total_revenue)}</div>
                                    </div>
                                ))}
                                {categoryRevenue.length === 0 && <div className="text-xs text-[var(--text-secondary)] text-center py-4">No data</div>}
                            </div>
                        </div>

                        {/* Peak Hours Widget */}
                        <div className="pos-card p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Clock size={18} className="text-purple-400" />
                                <h3 className="text-sm font-black text-[var(--foreground)] uppercase tracking-widest">
                                    Peak Ordering Hours
                                </h3>
                            </div>
                            <div className="flex items-end gap-1 h-32 mt-4">
                                {peakHours.length > 0 ? (() => {
                                    const maxOrders = Math.max(...peakHours.map(h => h.order_count));
                                    return peakHours.map(ph => {
                                        const height = (ph.order_count / maxOrders) * 100;
                                        return (
                                            <div key={ph.hour} className="flex-1 flex flex-col items-center gap-1 group" title={`${ph.hour} : ${ph.order_count} orders`}>
                                                <div className="w-full flex flex-col justify-end h-24">
                                                    <div 
                                                        className="w-full rounded-t-md bg-purple-500/50 group-hover:bg-purple-400 transition-colors"
                                                        style={{ height: `${Math.max(height, 5)}%` }} 
                                                    />
                                                </div>
                                                <span className="text-[9px] text-[var(--text-secondary)] font-mono">{ph.hour.split(':')[0]}h</span>
                                            </div>
                                        )
                                    });
                                })() : <div className="text-xs text-[var(--text-secondary)] text-center w-full py-4">No data</div>}
                            </div>
                        </div>

                        {/* Slow Movers Widget */}
                        <div className="pos-card p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <AlertTriangle size={18} className="text-rose-400" />
                                <h3 className="text-sm font-black text-[var(--foreground)] uppercase tracking-widest">
                                    Slow Movers (Last 30 Days)
                                </h3>
                            </div>
                            <div className="space-y-2">
                                {slowMovers.slice(0, 5).map(sm => (
                                    <div key={sm.id} className="flex items-center justify-between p-3 bg-rose-500/5 rounded-xl border border-rose-500/10">
                                        <div className="font-bold text-sm text-[var(--foreground)]">{sm.name}</div>
                                        <div className="text-right">
                                            <div className="font-mono font-bold text-rose-400">{sm.order_count} Sold</div>
                                            <div className="text-[10px] text-rose-400/60 font-bold uppercase tracking-widest">Action Needed</div>
                                        </div>
                                    </div>
                                ))}
                                {slowMovers.length === 0 && <div className="text-xs text-green-400 font-bold text-center py-4 bg-green-500/10 rounded-xl border border-green-500/20">All products are selling well!</div>}
                            </div>
                        </div>

                    </div>
                </>
            )}
        </div>
    );
}
