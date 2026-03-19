'use client';
import React, { useState, useEffect } from 'react';
import { getOrders, Order, getOrderItems, OrderItem, getRestaurant, Restaurant } from '@/lib/tauri-commands';
import { formatUsd, formatKhr } from '@/lib/currency';
import { printReceipt } from '@/lib/receipt';
import { 
    History, RefreshCw, TableProperties, ChevronDown, 
    ChevronUp, Download, Calendar, Filter, Search, Clock, Trash2, CheckCircle, ReceiptText
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

type StatusFilter = 'all' | 'open' | 'completed' | 'void';

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'open', label: 'Open' },
    { id: 'completed', label: 'Completed' },
    { id: 'void', label: 'Void' },
];

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
    completed: { bg: 'rgba(34,197,94,0.1)', text: '#22c55e', border: 'rgba(34,197,94,0.25)' },
    open:      { bg: 'rgba(249,115,22,0.1)', text: '#f97316', border: 'rgba(249,115,22,0.25)' },
    void:      { bg: 'rgba(239,68,68,0.1)', text: '#ef4444', border: 'rgba(239,68,68,0.25)' },
};

export default function HistoryPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<StatusFilter>('all');
    const [expandedRows, setExpandedRows] = useState<string[]>([]);
    const [orderDetails, setOrderDetails] = useState<Record<string, OrderItem[]>>({});
    
    // Default to today
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);

    useEffect(() => {
        loadOrders();
        loadRestaurant();
    }, [startDate, endDate]);

    async function loadRestaurant() {
        try {
            const data = await getRestaurant();
            setRestaurant(data);
        } catch (e) {
            console.error(e);
        }
    }

    async function loadOrders() {
        setLoading(true);
        try {
            // Using the backend filtering if available, else filter locally for now
            const data = await getOrders(undefined, startDate, endDate);
            setOrders(data.sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            ));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function toggleRow(orderId: string) {
        setExpandedRows(prev => {
            if (prev.includes(orderId)) {
                return prev.filter(id => id !== orderId);
            } else {
                return [...prev, orderId];
            }
        });

        if (!orderDetails[orderId]) {
            try {
                const items = await getOrderItems(orderId);
                setOrderDetails(prev => ({ ...prev, [orderId]: items }));
            } catch (e) {
                console.error('Failed to load order items:', e);
            }
        }
    }

    const handleExport = () => {
        const exportData = filtered.map(o => ({
            'Order #': o.id.split('-')[0].toUpperCase(),
            'Date & Time': new Date(o.created_at + 'Z').toLocaleString(),
            'Table': o.table_id || 'Takeout',
            'Status': o.status,
            'Total USD': (o.total_usd / 100).toFixed(2),
            'Total KHR': o.total_khr.toLocaleString(),
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Order History');
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `DineOS_Report_${startDate}_to_${endDate}.xlsx`);
    };

    const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);

    // Stats
    const completed = orders.filter(o => o.status === 'completed');
    const totalRevenueCents = completed.reduce((s, o) => s + o.total_usd, 0);

    return (
        <div className="max-w-7xl mx-auto px-6 py-6 space-y-6 animate-fade-in">
            {/* ── Header ── */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--accent)]/15 border border-[var(--accent)]/30">
                        <History size={18} className="text-[var(--accent)]" />
                    </div>
                    <div>
                        <h1 className="text-sm font-black uppercase tracking-widest text-[var(--foreground)]">Order History</h1>
                        <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-50">Transaction Audit</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-[var(--bg-card)] px-3 py-2 rounded-xl border border-[var(--border)]">
                        <Calendar size={14} className="text-[var(--accent)]" />
                        <input 
                            type="date" 
                            value={startDate} 
                            onChange={e => setStartDate(e.target.value)} 
                            className="bg-transparent text-xs font-black outline-none border-none text-[var(--foreground)]"
                        />
                        <span className="text-[var(--text-secondary)] font-black text-[10px] mx-0.5">—</span>
                        <input 
                            type="date" 
                            value={endDate} 
                            onChange={e => setEndDate(e.target.value)} 
                            className="bg-transparent text-xs font-black outline-none border-none text-[var(--foreground)]"
                        />
                    </div>

                    <button
                        onClick={handleExport}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-all font-black text-xs uppercase tracking-widest"
                    >
                        <Download size={14} />
                        Export
                    </button>

                    <button
                        onClick={loadOrders}
                        className="p-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] hover:bg-[var(--accent)] hover:text-black transition-all group"
                    >
                        <RefreshCw size={15} className={loading ? 'animate-spin' : 'group-active:rotate-180 transition-transform'} />
                    </button>
                </div>
            </div>

            {/* ── Summary Stat Pills ── */}
            <div className="flex flex-wrap gap-3">
                {[
                    { label: 'Revenue', value: formatUsd(totalRevenueCents), accent: 'var(--accent)' },
                    { label: 'Open', value: String(orders.filter(o => o.status === 'open').length), accent: '#f97316' },
                    { label: 'Completed', value: String(completed.length), accent: '#22c55e' },
                    { label: 'Void', value: String(orders.filter(o => o.status === 'void').length), accent: '#ef4444' },
                ].map(pill => (
                    <div key={pill.label} className="pos-card px-4 py-2.5 flex items-center gap-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60">{pill.label}</span>
                        <span className="text-sm font-black font-mono" style={{ color: pill.accent }}>{pill.value}</span>
                    </div>
                ))}
            </div>

            {/* ── Tabs & Content ── */}
            <div className="space-y-3">
                <div className="flex gap-2 overflow-x-auto pb-2 container-snap">
                    {STATUS_TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setFilter(tab.id)}
                            className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${filter === tab.id
                                ? 'bg-[var(--accent)] text-black shadow-lg shadow-[var(--accent)]/20'
                                : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--foreground)] border border-[var(--border)]'
                                }`}
                        >
                            {tab.label}
                            <span className={`ml-2 px-1.5 py-0.5 rounded-lg text-[10px] ${filter === tab.id ? 'bg-black/10' : 'bg-white/5'}`}>
                                {orders.filter(o => o.status === tab.id || tab.id === 'all').length}
                            </span>
                        </button>
                    ))}
                </div>

                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-2xl relative">
                    <div className="overflow-x-auto container-snap">
                        <table className="w-full text-left">
                            <thead className="bg-[var(--bg-elevated)] border-b border-[var(--border)]">
                                <tr>
                                    <th className="px-4 py-2.5 w-12"></th>
                                    {['Order #', 'Date & Time', 'Table', 'Status', 'Total USD', 'Total KHR'].map(h => (
                                        <th
                                            key={h}
                                            className="px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-60"
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                                {loading && filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-16 text-center">
                                            <RefreshCw size={24} className="animate-spin mx-auto opacity-20" />
                                        </td>
                                    </tr>
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-16 text-center opacity-30 font-black uppercase tracking-[0.2em] text-xs">
                                            No matching transactions
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((o) => {
                                        const isExpanded = expandedRows.includes(o.id);
                                        const style = STATUS_STYLES[o.status] ?? STATUS_STYLES['cancelled'];
                                        
                                        return (
                                            <React.Fragment key={o.id}>
                                                <tr
                                                    onClick={() => toggleRow(o.id)}
                                                    className={`transition-all hover:bg-white/[0.03] cursor-pointer group ${isExpanded ? 'bg-white/[0.02]' : ''}`}
                                                >
                                                    <td className="px-4 py-2.5">
                                                        <div className={`w-6 h-6 flex items-center justify-center rounded-lg transition-all ${isExpanded ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] group-hover:bg-[var(--accent)]/10 group-hover:text-[var(--accent)]'}`}>
                                                            {isExpanded ? <ChevronUp size={13} strokeWidth={3} /> : <ChevronDown size={13} strokeWidth={3} />}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2.5 font-mono text-xs font-black tracking-widest" style={{ color: isExpanded ? 'var(--accent)' : 'inherit' }}>
                                                        #{o.id.split('-')[0].toUpperCase()}
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        <div className="text-xs font-black mb-0.5">{new Date(o.created_at + 'Z').toLocaleDateString()}</div>
                                                        <div className="text-[10px] font-bold font-mono opacity-40 flex items-center gap-1">
                                                            <Clock size={10} />
                                                            {new Date(o.created_at + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        {o.table_id ? (
                                                            <span className="flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg bg-[var(--accent)]/5 border border-[var(--accent)]/20 text-[var(--accent)] w-fit uppercase tracking-widest">
                                                                <TableProperties size={10} />
                                                                {o.table_id}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-black opacity-20 uppercase tracking-widest">Takeout</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        <span
                                                            className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border"
                                                            style={{ background: style.bg, color: style.text, borderColor: style.border }}
                                                        >
                                                            {o.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2.5 font-mono font-black text-sm" style={{ color: o.status === 'void' ? 'inherit' : 'var(--accent)' }}>
                                                        <div className={o.status === 'void' ? 'line-through opacity-30 font-medium' : ''}>
                                                            {formatUsd(o.total_usd)}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2.5 font-mono text-xs opacity-60 font-black">
                                                        <div className={o.status === 'void' ? 'line-through opacity-20' : ''}>
                                                            {formatKhr(o.total_khr)}
                                                        </div>
                                                    </td>
                                                </tr>

                                                {isExpanded && (
                                                    <tr className="bg-black/30 animate-fade-in border-l-2 border-[var(--accent)]">
                                                        <td colSpan={7} className="px-5 py-4">
                                                            <div className="space-y-3">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        <ReceiptText size={14} className="text-[var(--accent)]" />
                                                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent)]">Itemized Transaction Audit</h4>
                                                                    </div>
                                                                    <div className="flex items-center gap-4">
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (restaurant && orderDetails[o.id]) {
                                                                                    printReceipt({
                                                                                        restaurant,
                                                                                        orderId: o.id,
                                                                                        tableId: o.table_id || undefined,
                                                                                        items: orderDetails[o.id],
                                                                                        payments: [],
                                                                                        totals: {
                                                                                            subtotalCents: o.total_usd,
                                                                                            vatCents: 0,
                                                                                            pltCents: 0,
                                                                                            totalUsdCents: o.total_usd,
                                                                                            totalKhr: o.total_khr
                                                                                        }
                                                                                    });
                                                                                }
                                                                            }}
                                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-black font-black text-[10px] uppercase tracking-widest hover:brightness-110 transition-all"
                                                                        >
                                                                            <ReceiptText size={12} />
                                                                            Print Receipt
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                
                                                                {orderDetails[o.id] ? (
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                                                        {orderDetails[o.id].map(item => (
                                                                            <div key={item.id} className="flex items-center justify-between bg-[var(--bg-elevated)] px-3 py-2.5 rounded-xl border border-[var(--border)] hover:border-[var(--accent)]/30 transition-all">
                                                                                <div className="flex items-center gap-3">
                                                                                    <div className="w-8 h-8 rounded-lg bg-black border border-white/5 flex items-center justify-center font-black text-[var(--accent)] text-xs flex-shrink-0">
                                                                                        {item.quantity}x
                                                                                    </div>
                                                                                    <div>
                                                                                        <p className="text-xs font-black text-white leading-tight">{item.product_name}</p>
                                                                                        <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">{formatUsd(item.price_at_order)} / unit</p>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="text-right flex-shrink-0">
                                                                                    <p className="text-xs font-black text-white">{formatUsd(item.price_at_order * item.quantity)}</p>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex flex-col items-center justify-center py-10 gap-4 opacity-30">
                                                                        <RefreshCw size={24} className="animate-spin" />
                                                                        <span className="text-[10px] font-black uppercase tracking-widest">Compiling details...</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
