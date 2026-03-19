'use client';
import { useEffect, useState } from 'react';
import { getRevenueSummary, getRevenueByPeriod, RevenueSummary, RevenueByDay } from '@/lib/tauri-commands';
import { useLanguage } from '@/providers/LanguageProvider';
import { formatUsd } from '@/lib/currency';
import { TrendingUp, ShoppingBag, DollarSign, Clock } from 'lucide-react';

type Period = 'week' | 'month' | '3months' | 'year';

const PERIOD_LABELS: Record<Period, { en: string; km: string }> = {
    week:    { en: 'Last 7 Days', km: '៧ ថ្ងៃចុងក្រោយ' },
    month:   { en: 'This Month',  km: 'ខែនេះ' },
    '3months': { en: 'Last 3 Months', km: '៣ ខែចុងក្រោយ' },
    year:    { en: 'This Year',   km: 'ឆ្នាំនេះ' },
};

export default function AnalyticsPage() {
    const { t, lang } = useLanguage();
    const [summary, setSummary] = useState<RevenueSummary | null>(null);
    const [chartData, setChartData] = useState<RevenueByDay[]>([]);
    const [period, setPeriod] = useState<Period>('month');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        async function load() {
            setLoading(true);
            setError('');
            try {
                const [s, d] = await Promise.all([
                    getRevenueSummary(),
                    getRevenueByPeriod(period),
                ]);
                setSummary(s);
                setChartData(d);
            } catch (e) {
                setError(lang === 'km' ? 'មិនអាចទាញប្រព័ន្ធ Tauri បាន' : 'Analytics unavailable outside Tauri desktop app.');
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [period]);

    const maxRevenue = chartData.length > 0 ? Math.max(...chartData.map(d => d.total_usd)) : 1;

    const statCards = summary ? [
        {
            label: lang === 'km' ? t('todayRevenue') : "Today's Revenue",
            value: formatUsd(summary.today_usd),
            sub: `${summary.today_orders} ${lang === 'km' ? 'លក្ខខណ្ឌ' : 'orders'}`,
            icon: DollarSign,
            color: 'text-green-400',
            bg: 'bg-green-500/10 border-green-500/20',
        },
        {
            label: lang === 'km' ? t('monthRevenue') : 'This Month',
            value: formatUsd(summary.month_usd),
            sub: `${summary.month_orders} ${lang === 'km' ? 'លក្ខខណ្ឌ' : 'orders'}`,
            icon: TrendingUp,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10 border-blue-500/20',
        },
        {
            label: lang === 'km' ? t('yearRevenue') : 'This Year',
            value: formatUsd(summary.year_usd),
            sub: `${summary.year_orders} ${lang === 'km' ? 'លក្ខខណ្ឌ' : 'orders'}`,
            icon: ShoppingBag,
            color: 'text-purple-400',
            bg: 'bg-purple-500/10 border-purple-500/20',
        },
        {
            label: lang === 'km' ? t('openOrders') : 'Open Tables',
            value: String(summary.open_orders),
            sub: lang === 'km' ? 'ក្នុងពេលនេះ' : 'active now',
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
                    {lang === 'km' ? t('revenueReport') : 'Revenue Report'}
                </h1>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {lang === 'km' ? 'ទិន្នន័យចំណូលភោជនីយដ្ឋានអ្នក' : 'Real-time earnings overview for your restaurant'}
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
                                {lang === 'km' ? 'ក្រាហ្វចំណូល' : 'Revenue Chart'}
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
                                        {PERIOD_LABELS[p][lang]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {chartData.length === 0 ? (
                            <div className="h-32 flex items-center justify-center">
                                <p className="text-xs text-[var(--text-secondary)]">
                                    {lang === 'km' ? 'គ្មានទិន្នន័យ' : 'No revenue data for this period.'}
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
                                                title={`${day.date}: ${formatUsd(day.total_usd)} (${day.order_count} orders)`}
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
                                        <span className="text-[var(--text-secondary)]">{lang === 'km' ? 'សរុប' : 'Total'}: </span>
                                        <span className="font-bold font-mono text-green-400">
                                            {formatUsd(chartData.reduce((s, d) => s + d.total_usd, 0))}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[var(--text-secondary)]">{lang === 'km' ? 'ការបញ្ជាទិញ' : 'Orders'}: </span>
                                        <span className="font-bold text-blue-400">
                                            {chartData.reduce((s, d) => s + d.order_count, 0)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
