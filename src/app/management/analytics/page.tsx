'use client';
import { useEffect, useState } from 'react';
import { getRevenueSummary, getRevenueByPeriod, getTopProducts, getRevenueByCategory, getPeakHours, getSlowMovers } from '@/lib/api/analytics';
import { useAuth } from '@/providers/AuthProvider';
import { RevenueSummary, RevenueByDay, TopProduct, CategoryRevenue, PeakHour } from '@/types';
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
    const { user } = useAuth();
    const restaurantId = user?.restaurant_id;
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
        if (!restaurantId) {
            setLoading(false);
            return;
        }

        async function load() {
            setLoading(true);
            setError('');
            try {
                const [s, d, tp, cr, ph, sm] = await Promise.all([
                    getRevenueSummary(restaurantId || undefined),
                    getRevenueByPeriod(period, restaurantId || undefined),
                    getTopProducts(period, restaurantId || undefined),
                    getRevenueByCategory(period, restaurantId || undefined),
                    getPeakHours(period, restaurantId || undefined),
                    getSlowMovers(restaurantId || undefined)
                ]);
                setSummary(s);
                setChartData(d);
                setTopProducts(tp);
                setCategoryRevenue(cr);
                setPeakHours(ph);
                setSlowMovers(sm);
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                console.error('[Analytics] Load failed:', msg);
                setError(msg || t('analyticsUnavailable'));
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [period, t, restaurantId]);

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
        <div className="space-y-6 pb-24 max-w-7xl mx-auto px-2">
            {/* Page header */}
            <div className="flex flex-col">
                <h1 className="text-lg font-black text-[var(--foreground)] uppercase tracking-widest leading-none">
                    {t('revenueReport')}
                </h1>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-secondary)] mt-2 opacity-60">
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
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {statCards.map((card, i) => (
                            <div key={i} className={`rounded-2xl border bg-[var(--bg-card)] p-5 transition-all hover:border-[var(--accent)]/30 relative overflow-hidden ${card.bg.includes('green') ? 'border-green-500/10' : card.bg.includes('blue') ? 'border-blue-500/10' : card.bg.includes('purple') ? 'border-purple-500/10' : 'border-orange-500/10'}`}>
                                <div className={`absolute top-0 left-0 w-1 h-full ${card.bg.split(' ')[0]}`} />
                                <div className="flex items-start justify-between mb-4">
                                    <p className={`text-[10px] font-black uppercase tracking-widest ${card.color}`}>{card.label}</p>
                                    <div className={`p-1.5 rounded-lg ${card.bg.split(' ')[0]}`}>
                                        <card.icon size={14} className={card.color} strokeWidth={2.5} />
                                    </div>
                                </div>
                                <p className="text-2xl font-black font-mono text-[var(--foreground)] tracking-tight leading-none">{card.value}</p>
                                <p className={`text-[9px] font-bold uppercase tracking-[0.2em] mt-2 opacity-60 ${card.color}`}>{card.sub}</p>
                            </div>
                        ))}
                    </div>

                    {/* Chart section */}
                    <div className="rounded-2xl border border-white/5 bg-[var(--bg-card)] p-6">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-dashed border-white/5">
                            <h2 className="text-sm font-black text-[var(--foreground)] uppercase tracking-widest">
                                {t('revenueChart')}
                            </h2>
                            <div className="flex items-center gap-1.5">
                                {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
                                    <button
                                        key={p}
                                        onClick={() => setPeriod(p)}
                                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${
                                            period === p
                                                ? 'bg-[var(--accent-blue)] text-white shadow-md'
                                                : 'text-[var(--text-secondary)] bg-[var(--bg-elevated)] border border-[var(--border)] hover:text-white hover:border-[var(--accent-blue)]/50'
                                        }`}
                                    >
                                        {t(PERIOD_LABELS[p])}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {chartData.length === 0 ? (
                            <div className="h-48 flex items-center justify-center opacity-30">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                                    {t('noRevenueData')}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Bar chart */}
                                <div className="flex items-end gap-1.5 h-48">
                                    {chartData.map((day, i) => {
                                        const height = maxRevenue > 0 ? (day.total_usd / maxRevenue) * 100 : 0;
                                        return (
                                            <div
                                                key={day.date}
                                                className="flex-1 flex flex-col items-center gap-2 group relative"
                                                title={`${day.date}: ${formatUsd(day.total_usd)} (${day.order_count} ${t('orders')})`}
                                            >
                                                <div className="w-full flex flex-col justify-end h-full relative">
                                                    <div
                                                        className="w-full rounded-md bg-[var(--accent-blue)]/80 group-hover:bg-[var(--accent-blue)] transition-all relative overflow-hidden shadow-sm"
                                                        style={{ height: `${Math.max(height, 2)}%`, minHeight: '4px' }}
                                                    >
                                                        <div className="absolute top-0 left-0 w-full h-1 bg-white/20" />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {/* Labels */}
                                <div className="flex gap-1.5 pt-2">
                                    {chartData.map(day => {
                                        const d = new Date(day.date);
                                        const label = chartData.length <= 14
                                            ? `${d.getMonth()+1}/${d.getDate()}`
                                            : `${d.getMonth()+1}/${d.getDate()}`;
                                        return (
                                            <div key={day.date} className="flex-1 text-center text-[9px] font-mono font-bold text-[var(--text-secondary)] opacity-60 truncate">
                                                {label}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Summary row */}
                                <div className="mt-4 pt-4 border-t border-dashed border-white/5 flex items-center gap-8">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-50 mb-1">{t('total')}</span>
                                        <span className="font-black font-mono text-lg text-[var(--accent-green)] leading-none">
                                            {formatUsd(chartData.reduce((s, d) => s + d.total_usd, 0))}
                                        </span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-50 mb-1">{t('orders')}</span>
                                        <span className="font-black text-lg text-[var(--accent-blue)] leading-none">
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
                        <div className="rounded-2xl border border-white/5 bg-[var(--bg-card)] p-6">
                            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-dashed border-white/5">
                                <div className="bg-orange-500/10 p-2 rounded-xl border border-orange-500/20">
                                    <Flame size={16} className="text-orange-400" />
                                </div>
                                <h3 className="text-xs font-black text-[var(--foreground)] uppercase tracking-widest">
                                    Top Products
                                </h3>
                            </div>
                            <div className="space-y-3">
                                {topProducts.slice(0, 5).map((p, i) => (
                                    <div key={p.id} className="flex items-center justify-between p-3 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border)]">
                                        <div className="flex items-center gap-3">
                                            <div className="w-7 h-7 rounded-lg bg-[var(--bg-dark)] border border-white/5 text-orange-400 font-mono font-black text-[10px] flex items-center justify-center shadow-inner">
                                                {i + 1}
                                            </div>
                                            <div className="font-black text-[11px] text-[var(--foreground)] uppercase tracking-wide">{p.name}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-mono font-black text-sm text-[var(--accent-green)] leading-none mb-1">{formatUsd(p.total_revenue)}</div>
                                            <div className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-[0.2em] opacity-60">{p.order_count} Sold</div>
                                        </div>
                                    </div>
                                ))}
                                {topProducts.length === 0 && <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] text-center py-6 opacity-40">No data</div>}
                            </div>
                        </div>

                        {/* Revenue by Category Widget */}
                        <div className="rounded-2xl border border-white/5 bg-[var(--bg-card)] p-6">
                            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-dashed border-white/5">
                                <div className="bg-blue-500/10 p-2 rounded-xl border border-blue-500/20">
                                    <PieChart size={16} className="text-blue-400" />
                                </div>
                                <h3 className="text-xs font-black text-[var(--foreground)] uppercase tracking-widest">
                                    Revenue By Category
                                </h3>
                            </div>
                            <div className="space-y-3">
                                {categoryRevenue.map((c) => (
                                    <div key={c.id} className="flex items-center justify-between p-3.5 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border)]">
                                        <div className="font-black text-[11px] text-[var(--foreground)] uppercase tracking-wide">{c.name}</div>
                                        <div className="font-mono font-black text-sm text-[var(--accent-blue)]">{formatUsd(c.total_revenue)}</div>
                                    </div>
                                ))}
                                {categoryRevenue.length === 0 && <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] text-center py-6 opacity-40">No data</div>}
                            </div>
                        </div>

                        {/* Peak Hours Widget */}
                        <div className="rounded-2xl border border-white/5 bg-[var(--bg-card)] p-6">
                            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-dashed border-white/5">
                                <div className="bg-purple-500/10 p-2 rounded-xl border border-purple-500/20">
                                    <Clock size={16} className="text-purple-400" />
                                </div>
                                <h3 className="text-xs font-black text-[var(--foreground)] uppercase tracking-widest">
                                    Peak Ordering Hours
                                </h3>
                            </div>
                            <div className="flex items-end gap-1.5 h-36 mt-4">
                                {peakHours.length > 0 ? (() => {
                                    const maxOrders = Math.max(...peakHours.map(h => h.order_count));
                                    return peakHours.map(ph => {
                                        const height = (ph.order_count / maxOrders) * 100;
                                        return (
                                            <div key={ph.hour} className="flex-1 flex flex-col items-center gap-2 group relative" title={`${ph.hour} : ${ph.order_count} orders`}>
                                                <div className="w-full flex flex-col justify-end h-full">
                                                    <div 
                                                        className="w-full rounded-md bg-purple-500/50 group-hover:bg-purple-400 transition-colors relative overflow-hidden"
                                                        style={{ height: `${Math.max(height, 5)}%`, minHeight: '4px' }}
                                                    >
                                                        <div className="absolute top-0 left-0 w-full h-1 bg-white/30" />
                                                    </div>
                                                </div>
                                                <span className="text-[9px] text-[var(--text-secondary)] font-mono font-bold opacity-60 pt-1">{ph.hour.split(':')[0]}h</span>
                                            </div>
                                        )
                                    });
                                })() : <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] text-center w-full py-6 opacity-40">No data</div>}
                            </div>
                        </div>

                        {/* Slow Movers Widget */}
                        <div className="rounded-2xl border border-white/5 bg-[var(--bg-card)] p-6">
                            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-dashed border-white/5">
                                <div className="bg-rose-500/10 p-2 rounded-xl border border-rose-500/20">
                                    <AlertTriangle size={16} className="text-rose-400" />
                                </div>
                                <h3 className="text-xs font-black text-[var(--foreground)] uppercase tracking-widest">
                                    Slow Movers (Last 30 Days)
                                </h3>
                            </div>
                            <div className="space-y-3">
                                {slowMovers.slice(0, 5).map(sm => (
                                    <div key={sm.id} className="flex items-center justify-between p-3.5 bg-rose-500/10 rounded-xl border border-rose-500/20">
                                        <div className="font-black text-[11px] text-[var(--foreground)] uppercase tracking-wide">{sm.name}</div>
                                        <div className="text-right flex flex-col gap-0.5">
                                            <div className="font-mono font-black text-sm text-rose-400 leading-none">{sm.order_count} Sold</div>
                                            <div className="text-[9px] text-rose-400/60 font-bold uppercase tracking-[0.2em]">Action Needed</div>
                                        </div>
                                    </div>
                                ))}
                                {slowMovers.length === 0 && <div className="text-[10px] text-[var(--accent-green)] font-black uppercase tracking-[0.2em] text-center p-6 bg-[var(--accent-green)]/10 rounded-xl border border-[var(--accent-green)]/20 shadow-inner">All products are selling well!</div>}
                            </div>
                        </div>

                    </div>
                </>
            )}
        </div>
    );
}
