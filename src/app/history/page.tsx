'use client';
import { useState, useEffect } from 'react';
import { getOrders, Order } from '@/lib/tauri-commands';
import { formatUsd, formatKhr } from '@/lib/currency';
import { History, RefreshCw, TableProperties } from 'lucide-react';

type StatusFilter = 'all' | 'open' | 'completed' | 'void' | 'cancelled';

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'open', label: 'Open' },
    { id: 'completed', label: 'Completed' },
    { id: 'void', label: 'Void' },
    { id: 'cancelled', label: 'Cancelled' },
];

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
    completed: { bg: 'rgba(16,185,129,0.1)', text: '#10b981', border: 'rgba(16,185,129,0.25)' },
    open:      { bg: 'rgba(245,158,11,0.1)', text: '#f59e0b', border: 'rgba(245,158,11,0.25)' },
    void:      { bg: 'rgba(239,68,68,0.1)', text: '#ef4444', border: 'rgba(239,68,68,0.25)' },
    cancelled: { bg: 'rgba(107,114,128,0.1)', text: '#9ca3af', border: 'rgba(107,114,128,0.25)' },
};

export default function HistoryPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<StatusFilter>('all');

    useEffect(() => {
        loadOrders();
    }, []);

    async function loadOrders() {
        setLoading(true);
        try {
            const data = await getOrders();
            // Sort newest first
            setOrders(data.sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            ));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);

    // Stats
    const completed = orders.filter(o => o.status === 'completed');
    const totalRevenue = completed.reduce((s, o) => s + o.total_usd, 0);

    return (
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6 animate-fade-in">
            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #f59e0b, #b45309)' }}
                    >
                        <History size={20} color="#000" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black">Order History</h1>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {orders.length} orders total
                        </p>
                    </div>
                </div>

                <button
                    onClick={loadOrders}
                    className="btn-ghost px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-semibold"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* ── Summary Cards ── */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    {
                        label: 'Total Revenue', value: formatUsd(totalRevenue),
                        sub: `${completed.length} completed orders`,
                        accent: 'var(--accent)',
                    },
                    {
                        label: 'Open Orders', value: orders.filter(o => o.status === 'open').length.toString(),
                        sub: 'Currently active',
                        accent: '#f59e0b',
                    },
                    {
                        label: 'Voided', value: orders.filter(o => o.status === 'void').length.toString(),
                        sub: 'Not counted in revenue',
                        accent: 'var(--accent-red)',
                    },
                ].map(card => (
                    <div
                        key={card.label}
                        className="glass-bright rounded-2xl p-5"
                    >
                        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-secondary)' }}>
                            {card.label}
                        </p>
                        <p className="text-2xl font-black font-mono" style={{ color: card.accent }}>
                            {card.value}
                        </p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                            {card.sub}
                        </p>
                    </div>
                ))}
            </div>

            {/* ── Filter Tabs ── */}
            <div className="flex gap-2">
                {STATUS_TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setFilter(tab.id)}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${filter === tab.id
                            ? 'bg-[var(--accent)] text-black'
                            : 'btn-ghost'
                            }`}
                    >
                        {tab.label}
                        {tab.id !== 'all' && (
                            <span
                                className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full"
                                style={{
                                    background: filter === tab.id ? 'rgba(0,0,0,0.2)' : 'var(--bg-elevated)',
                                    color: filter === tab.id ? '#000' : 'var(--text-secondary)',
                                }}
                            >
                                {orders.filter(o => o.status === tab.id).length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* ── Table ── */}
            <div
                className="rounded-2xl overflow-hidden"
                style={{ border: '1px solid var(--border)' }}
            >
                <table className="w-full text-left">
                    <thead style={{ background: 'var(--bg-dark)', borderBottom: '1px solid var(--border)' }}>
                        <tr>
                            {['Order #', 'Date & Time', 'Table', 'Status', 'Total USD', 'Total KHR'].map(h => (
                                <th
                                    key={h}
                                    className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider"
                                    style={{ color: 'var(--text-secondary)' }}
                                >
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="px-5 py-12 text-center">
                                    <RefreshCw size={24} className="animate-spin mx-auto" style={{ color: 'var(--text-secondary)' }} />
                                </td>
                            </tr>
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-5 py-12 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                                    No orders found.
                                </td>
                            </tr>
                        ) : (
                            filtered.map((o, i) => {
                                const style = STATUS_STYLES[o.status] ?? STATUS_STYLES['cancelled'];
                                return (
                                    <tr
                                        key={o.id}
                                        className="transition-colors"
                                        style={{
                                            background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-dark)',
                                            borderBottom: '1px solid var(--border)',
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-dark)')}
                                    >
                                        <td className="px-5 py-4 font-mono text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>
                                            #{o.id.split('-')[0].toUpperCase()}
                                        </td>
                                        <td className="px-5 py-4 text-sm">
                                            {new Date(o.created_at + 'Z').toLocaleString()}
                                        </td>
                                        <td className="px-5 py-4 text-sm">
                                            {o.table_id ? (
                                                <span
                                                    className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg w-fit"
                                                    style={{
                                                        background: 'rgba(245,158,11,0.08)',
                                                        border: '1px solid rgba(245,158,11,0.2)',
                                                        color: 'var(--accent)',
                                                    }}
                                                >
                                                    <TableProperties size={11} />
                                                    {o.table_id}
                                                </span>
                                            ) : (
                                                <span style={{ color: 'var(--text-secondary)', opacity: 0.4 }}>—</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4">
                                            <span
                                                className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide"
                                                style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}` }}
                                            >
                                                {o.status}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 font-mono font-bold" style={{ color: 'var(--accent)' }}>
                                            {formatUsd(o.total_usd)}
                                        </td>
                                        <td className="px-5 py-4 font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>
                                            {formatKhr(o.total_khr)}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
