'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getOrders, getOrderItems } from '@/lib/api/orders';
import { getRestaurant } from '@/lib/api/restaurant';
import { Order, OrderItem, Restaurant } from '@/types';
import { useAuth } from '@/providers/AuthProvider';
import { formatUsd, formatKhr } from '@/lib/currency';
import { printReceipt } from '@/lib/receipt';
import { 
    History, RefreshCw, TableProperties, ChevronDown, 
    ChevronUp, Download, Calendar, Clock, ReceiptText,
    LayoutList, LayoutGrid, Printer
} from 'lucide-react';
// Dynamic import for XLSX to avoid bundling issues
let XLSX_MODULE: any = null;
import { useLanguage } from '@/providers/LanguageProvider';
import { call } from '@/lib/api/client';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { printSummaryReport } from '@/lib/reports';

type StatusFilter = 'all' | 'open' | 'completed' | 'hold';

export interface GroupedOrder {
    id: string; // session_id or order_id
    table_id: string | null;
    status: StatusFilter | 'pending_payment';
    created_at: string;
    total_usd: number;
    total_khr: number;
    orders: Order[];
}

function combineOrderItems(items: OrderItem[]): OrderItem[] {
    const map = new Map<string, OrderItem>();
    for (const item of items) {
        if (map.has(item.product_id)) {
            map.get(item.product_id)!.quantity += item.quantity;
        } else {
            map.set(item.product_id, { ...item });
        }
    }
    return Array.from(map.values());
}

const STATUS_TABS: { id: StatusFilter; labelKey: any }[] = [
    { id: 'all', labelKey: 'allFilter' },
    { id: 'open', labelKey: 'open' },
    { id: 'completed', labelKey: 'completed' },
    { id: 'hold', labelKey: 'hold' },
];

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
    completed:       { bg: 'rgba(34,197,94,0.1)',  text: '#22c55e', border: 'rgba(34,197,94,0.25)' },
    open:            { bg: 'rgba(249,115,22,0.1)', text: '#f97316', border: 'rgba(249,115,22,0.25)' },
    hold:            { bg: 'rgba(234,179,8,0.12)', text: '#eab308', border: 'rgba(234,179,8,0.3)' },
    pending_payment: { bg: 'rgba(234,179,8,0.12)', text: '#eab308', border: 'rgba(234,179,8,0.3)' },
};

export default function HistoryPage() {
    const { t, lang } = useLanguage();
    const { user } = useAuth();
    const restaurantId = user?.restaurant_id;
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<StatusFilter>('all');
    const [expandedRows, setExpandedRows] = useState<string[]>([]);
    const [orderDetails, setOrderDetails] = useState<Record<string, OrderItem[]>>({});
    const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid');
    const loadingItemsRef = useRef<Set<string>>(new Set());
    
    const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);

    useEffect(() => {
        loadOrders();
        loadRestaurant();
    }, [startDate, endDate]);

    async function loadRestaurant() {
        try {
            const data = await getRestaurant(restaurantId || undefined);
            setRestaurant(data);
        } catch (e) {
            console.error(e);
        }
    }

    async function loadOrders() {
        setLoading(true);
        try {
            const data = await getOrders(undefined, startDate, endDate, restaurantId || '');
            setOrders(data.sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            ));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    const allGroupedOrders = useMemo(() => {
        const map = new Map<string, GroupedOrder>();
        for (const o of orders) {
            const key = o.session_id || o.id;
            if (!map.has(key)) {
                map.set(key, {
                    id: key,
                    table_id: o.table_id || null,
                    status: o.status as any,
                    created_at: o.created_at,
                    total_usd: 0,
                    total_khr: 0,
                    orders: []
                });
            }
            const g = map.get(key)!;
            g.total_usd += o.total_usd;
            g.total_khr += o.total_khr;
            g.orders.push(o);
            // take earliest date
            if (new Date(o.created_at) < new Date(g.created_at)) {
                g.created_at = o.created_at;
            }
            // Upgrade group status priority: open > hold > completed
            if (o.status === 'open') g.status = 'open' as any;
            else if (['hold', 'pending_payment'].includes(o.status) && g.status !== 'open') g.status = 'hold' as any;
        }
        return Array.from(map.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [orders]);

    const groupedOrders = useMemo(() => {
        if (filter === 'all') return allGroupedOrders;
        return allGroupedOrders.filter(g => g.status === filter);
    }, [allGroupedOrders, filter]);

    const filtered = groupedOrders;

    useEffect(() => {
        if (viewMode !== 'grid' || filtered.length === 0) return;
        
        const toLoad: Order[] = [];
        filtered.forEach(g => {
            g.orders.forEach(o => {
                if (!orderDetails[o.id] && !loadingItemsRef.current.has(o.id)) {
                    toLoad.push(o);
                }
            });
        });

        if (toLoad.length === 0) return;

        toLoad.forEach(o => loadingItemsRef.current.add(o.id));
        Promise.all(
            toLoad.map(o =>
                getOrderItems(o.id, restaurantId || '')
                    .then(items => ({ id: o.id, items }))
                    .catch(() => ({ id: o.id, items: [] as OrderItem[] }))
            )
        ).then(results => {
            setOrderDetails(prev => {
                const next = { ...prev };
                results.forEach(r => { next[r.id] = r.items; });
                return next;
            });
            results.forEach(r => loadingItemsRef.current.delete(r.id));
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewMode, filter, orders]);

    async function toggleRow(groupId: string) {
        setExpandedRows(prev => {
            if (prev.includes(groupId)) return prev.filter(id => id !== groupId);
            return [...prev, groupId];
        });

        const group = groupedOrders.find(g => g.id === groupId);
        if (!group) return;

        group.orders.forEach(async (order) => {
            if (!orderDetails[order.id]) {
                try {
                    const items = await getOrderItems(order.id, restaurantId || '');
                    setOrderDetails(prev => ({ ...prev, [order.id]: items }));
                } catch (e) {
                    console.error('Failed to load items', e);
                }
            }
        });
    }

    const handleExport = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        try {
            if (!filtered || filtered.length === 0) {
                window.alert(t('noMatchingTransactions'));
                return;
            }

            // Load XLSX
            if (!XLSX_MODULE) {
                XLSX_MODULE = await import('xlsx');
            }
            const X = XLSX_MODULE.utils ? XLSX_MODULE : XLSX_MODULE.default;
            if (!X || !X.utils) throw new Error('XLSX utils not found');

            // Map data
            const exportData = filtered.map(g => {
                const isoDate = g.created_at.replace(' ', 'T') + 'Z';
                return {
                    'ID': g.id.split('-')[0].toUpperCase(),
                    'Date': new Date(isoDate).toLocaleDateString(),
                    'Table': g.table_id || 'Takeout',
                    'Status': g.status.toUpperCase(),
                    'USD': (g.total_usd / 100).toFixed(2),
                    'KHR': g.total_khr.toLocaleString(),
                };
            });

            // Generate WB
            const ws = X.utils.json_to_sheet(exportData);
            const wb = X.utils.book_new();
            X.utils.book_append_sheet(wb, ws, 'Orders');
            
            // Generate Array Buffer
            const excelBuffer = X.write(wb, { bookType: 'xlsx', type: 'array' });
            
            // Convert to regular array for IPC transfer
            const content = Array.from(new Uint8Array(excelBuffer));
            const filename = `Report_${startDate}_to_${endDate}.xlsx`;
            
            // Invoke native Rust bridge to save file
            const savedPath = await call<string>('save_excel_file', { content, filename });
            
            if (savedPath === 'CANCELLED') {
                console.log('Export cancelled by user.');
                return;
            }
            
            window.alert('Success! Report saved to:\n' + savedPath);
            console.log('Report saved to:', savedPath);
        } catch (error: any) {
            console.error('Export critical failure:', error);
            window.alert('Export Failed: ' + error.message);
        }
    };

    const handlePrintSummary = () => {
        if (!restaurant || !filtered || filtered.length === 0) return;
        
        let totalUsd = 0;
        let totalKhr = 0;
        filtered.forEach(g => {
            totalUsd += g.total_usd;
            totalKhr += g.total_khr;
        });

        printSummaryReport({
            restaurant,
            startDate: startDate,
            endDate: endDate,
            orders: filtered,
            totalUsd,
            totalKhr
        });
    };

    // Stats
    const completed = allGroupedOrders.filter(g => g.status === 'completed');
    
    // Total revenue is just the sum of completed groups
    const totalRevenueCents = completed.reduce((s, g) => s + g.total_usd, 0);

    return (
        <div className="max-w-7xl mx-auto px-6 py-6 space-y-6 animate-fade-in">
            {/* ── Header ── */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--accent)]/15 border border-[var(--accent)]/30">
                        <History size={18} className="text-[var(--accent)]" />
                    </div>
                    <div>
                        <h1 className="text-sm font-black uppercase tracking-widest text-[var(--foreground)]">{t('orderHistory')}</h1>
                        <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-50">{t('transactionAuditSub')}</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <div className="relative group">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="pos-input px-3 text-xs h-10 w-[160px] cursor-pointer hover:border-[var(--accent)] transition-all bg-[var(--bg-card)] font-black uppercase tracking-widest text-[var(--foreground)]"
                            />
                        </div>
                        <span className="text-[var(--text-secondary)] font-black text-[10px] uppercase tracking-widest opacity-30">TO</span>
                        <div className="relative group">
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="pos-input px-3 text-xs h-10 w-[160px] cursor-pointer hover:border-[var(--accent)] transition-all bg-[var(--bg-card)] font-black uppercase tracking-widest text-[var(--foreground)]"
                            />
                        </div>
                    </div>

                    <button 
                        onClick={handlePrintSummary}
                        disabled={loading || !filtered?.length}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[var(--accent-blue)] hover:bg-[var(--accent-blue)] hover:text-white transition-all disabled:opacity-30 font-black text-xs uppercase tracking-widest"
                    >
                        <Printer size={14} />
                        PRINT
                    </button>

                    <button
                        type="button"
                        onClick={handleExport}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-all font-black text-xs uppercase tracking-widest"
                    >
                        <Download size={14} />
                        {t('exportBtn')}
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
                    { label: t('revenue'), value: formatUsd(totalRevenueCents), accent: 'var(--accent)' },
                    { label: t('open'), value: String(allGroupedOrders.filter(g => g.status === 'open').length), accent: '#f97316' },
                    { label: t('completed'), value: String(completed.length), accent: '#22c55e' },
                    { label: 'HOLD', value: String(allGroupedOrders.filter(g => g.status === 'hold' || g.status === 'pending_payment').length), accent: '#eab308' },
                ].map(pill => (
                    <div key={pill.label} className="pos-card px-4 py-2.5 flex items-center gap-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60">{pill.label}</span>
                        <span className="text-sm font-black font-mono" style={{ color: pill.accent }}>{pill.value}</span>
                    </div>
                ))}
            </div>

            {/* ── Tabs & Content ── */}
            <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
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
                                {t(tab.labelKey)}
                                <span className={`ml-2 px-1.5 py-0.5 rounded-lg text-[10px] ${filter === tab.id ? 'bg-black/10' : 'bg-white/5'}`}>
                                    {allGroupedOrders.filter(g => tab.id === 'all' || g.status === tab.id).length}
                                </span>
                            </button>
                        ))}
                    </div>
                    {/* View mode toggle */}
                    <div className="flex items-center gap-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-1 flex-shrink-0">
                        <button
                            onClick={() => setViewMode('table')}
                            title="Table view"
                            className={`p-1.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-[var(--accent)] text-black' : 'text-[var(--text-secondary)] hover:text-[var(--foreground)]'}`}
                        >
                            <LayoutList size={15} strokeWidth={2.5} />
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            title="Receipt grid view"
                            className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-[var(--accent)] text-black' : 'text-[var(--text-secondary)] hover:text-[var(--foreground)]'}`}
                        >
                            <LayoutGrid size={15} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                {viewMode === 'table' ? (
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-2xl relative">
                    <div className="overflow-x-auto container-snap">
                        <table className="w-full text-left">
                            <thead className="bg-[var(--bg-elevated)] border-b border-[var(--border)]">
                                <tr>
                                    <th className="px-4 py-2.5 w-12"></th>
                                    {[t('receiptId'), t('timestamp'), t('tableLabel'), t('orderStatus'), t('totalUsd'), t('totalKhr')].map(h => (
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
                                            {t('noMatchingTransactions')}
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((g) => {
                                        const isExpanded = expandedRows.includes(g.id);
                                        const style = STATUS_STYLES[g.status] ?? STATUS_STYLES['completed'];
                                        
                                        return (
                                            <React.Fragment key={g.id}>
                                                <tr
                                                    onClick={() => toggleRow(g.id)}
                                                    className={`transition-all hover:bg-white/[0.03] cursor-pointer group ${isExpanded ? 'bg-white/[0.02]' : ''}`}
                                                >
                                                    <td className="px-4 py-2.5">
                                                        <div className={`w-6 h-6 flex items-center justify-center rounded-lg transition-all ${isExpanded ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] group-hover:bg-[var(--accent)]/10 group-hover:text-[var(--accent)]'}`}>
                                                            {isExpanded ? <ChevronUp size={13} strokeWidth={3} /> : <ChevronDown size={13} strokeWidth={3} />}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2.5 font-mono text-xs font-black tracking-widest" style={{ color: isExpanded ? 'var(--accent)' : 'inherit' }}>
                                                        {g.table_id ? `SESSION ${g.id.split('-')[0].toUpperCase()}` : `#${g.id.split('-')[0].toUpperCase()}`}
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        <div className="text-xs font-black mb-0.5">{new Date(g.created_at + 'Z').toLocaleDateString()}</div>
                                                        <div className="text-[10px] font-bold font-mono opacity-40 flex items-center gap-1">
                                                            <Clock size={10} />
                                                            {new Date(g.created_at + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        {g.table_id ? (
                                                            <span className="flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg bg-[var(--accent)]/5 border border-[var(--accent)]/20 text-[var(--accent)] w-fit uppercase tracking-widest">
                                                                <TableProperties size={10} />
                                                                {g.table_id}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-black opacity-20 uppercase tracking-widest">{t('takeout')}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        <span
                                                            className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border"
                                                            style={{ background: style.bg, color: style.text, borderColor: style.border }}
                                                        >
                                                            {['hold', 'pending_payment'].includes(g.status) ? 'HOLD' : t(g.status as any)}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2.5 font-mono font-black text-sm" style={{ color: 'var(--accent)' }}>
                                                        <div>
                                                            {formatUsd(g.total_usd)}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2.5 font-mono text-xs opacity-60 font-black">
                                                        <div>
                                                            {formatKhr(g.total_khr)}
                                                        </div>
                                                    </td>
                                                </tr>

                                                {isExpanded && (
                                                    <tr className="bg-black/30 animate-fade-in border-l-2 border-[var(--accent)]">
                                                        <td colSpan={7} className="px-5 py-4">
                                                            <div className="space-y-4">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        <ReceiptText size={14} className="text-[var(--accent)]" />
                                                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent)]">Master Table Receipt</h4>
                                                                    </div>
                                                                    <div className="flex items-center gap-4">
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (restaurant) {
                                                                                    const allItems = combineOrderItems(g.orders.flatMap(o => orderDetails[o.id] || []));
                                                                                    printReceipt({
                                                                                        restaurant,
                                                                                        orderId: g.id,
                                                                                        tableId: g.table_id || undefined,
                                                                                        customerName: undefined,
                                                                                        customerPhone: undefined,
                                                                                        items: allItems,
                                                                                        payments: [],
                                                                                        totals: {
                                                                                            subtotalCents: g.total_usd,
                                                                                            vatCents: 0,
                                                                                            pltCents: 0,
                                                                                            totalUsdCents: g.total_usd,
                                                                                            totalKhr: g.total_khr
                                                                                        }
                                                                                    });
                                                                                }
                                                                            }}
                                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-black font-black text-[10px] uppercase tracking-widest hover:brightness-110 transition-all"
                                                                        >
                                                                            <ReceiptText size={12} />
                                                                            Print Master Receipt
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                
                                                                <div className="space-y-3">
                                                                    {g.orders.map((o, index) => (
                                                                        <div key={o.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3">
                                                                            <div className="flex items-center justify-between mb-3 border-b border-[var(--border)] pb-2 text-[10px] font-black uppercase tracking-widest opacity-60">
                                                                                <span>{g.table_id ? `Round ${index + 1}` : 'Order Segment'} - #{o.id.split('-')[0].toUpperCase()}</span>
                                                                                <span>{new Date(o.created_at + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                                            </div>
                                                                            
                                                                            {orderDetails[o.id] ? (
                                                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                                                                    {orderDetails[o.id].map(item => (
                                                                                        <div key={item.id} className="flex items-center justify-between bg-[var(--bg-elevated)] px-3 py-2.5 rounded-lg border border-[var(--border)] transition-all">
                                                                                            <div className="flex items-center gap-3">
                                                                                                <div className="w-8 h-8 rounded bg-black border border-white/5 flex items-center justify-center font-black text-[var(--accent)] text-xs flex-shrink-0">
                                                                                                    {item.quantity}x
                                                                                                </div>
                                                                                                <div>
                                                                                                    <p className="text-xs font-black text-white leading-tight">{lang === 'km' && item.product_khmer ? item.product_khmer : item.product_name}</p>
                                                                                                    <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">{formatUsd(item.price_at_order)} / unit</p>
                                                                                                </div>
                                                                                            </div>
                                                                                            <div className="text-right flex-shrink-0">
                                                                                                <p className="text-xs font-black text-[var(--foreground)]">{formatUsd(item.price_at_order * item.quantity)}</p>
                                                                                            </div>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            ) : (
                                                                                <div className="flex items-center justify-center p-4">
                                                                                    <RefreshCw size={14} className="animate-spin opacity-30" />
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
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
                ) : (
                /* ── Receipt Grid View ── */
                filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-3 opacity-30">
                        <ReceiptText size={36} />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">{t('noMatchingTransactions')}</span>
                    </div>
                ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-fade-in">
                    {filtered.map(g => {
                        const style = STATUS_STYLES[g.status] ?? STATUS_STYLES['completed'];
                        const items = combineOrderItems(g.orders.flatMap(o => orderDetails[o.id] || []));
                        const isLoaded = g.orders.every(o => orderDetails[o.id] !== undefined);
                        
                        const dt = new Date(g.created_at + 'Z');
                        return (
                            <div
                                key={g.id}
                                className="flex flex-col bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden hover:border-[var(--accent)]/40 transition-all shadow-xl"
                            >
                                {/* Receipt tape top */}
                                <div
                                    className="h-1.5 w-full"
                                    style={{ background: `linear-gradient(90deg, ${style.text}55 0%, ${style.text} 50%, ${style.text}55 100%)` }}
                                />

                                {/* Header */}
                                <div className="px-4 pt-4 pb-3 border-b border-dashed border-white/10">
                                    <div className="flex items-start justify-between mb-2">
                                        <span
                                            className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border"
                                            style={{ background: style.bg, color: style.text, borderColor: style.border }}
                                        >
                                            {['hold', 'pending_payment'].includes(g.status) ? 'HOLD' : t(g.status as any)}
                                        </span>
                                        {g.table_id ? (
                                            <span className="flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-md bg-[var(--accent)]/10 border border-[var(--accent)]/25 text-[var(--accent)] uppercase tracking-widest">
                                                <TableProperties size={9} />
                                                {g.table_id}
                                            </span>
                                        ) : (
                                            <span className="text-[9px] font-black opacity-25 uppercase tracking-widest">{t('takeout')}</span>
                                        )}
                                    </div>
                                    <p className="font-mono text-xs font-black text-[var(--accent)] tracking-widest">
                                        {g.table_id ? `SESSION ${g.id.split('-')[0].toUpperCase()}` : `#${g.id.split('-')[0].toUpperCase()}`}
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-1 text-[var(--text-secondary)] opacity-50">
                                        <Clock size={10} />
                                        <span className="text-[10px] font-mono font-bold">
                                            {dt.toLocaleDateString()} · {dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <div className="mt-2 text-[9px] font-black opacity-30 uppercase tracking-[0.1em]">
                                        {g.orders.length} Rounds
                                    </div>
                                </div>

                                {/* Items */}
                                <div className="flex-1 px-4 py-3 space-y-1.5 min-h-[80px]">
                                    {isLoaded ? (
                                        items.length === 0 ? (
                                            <p className="text-[10px] opacity-20 font-black uppercase tracking-widest text-center py-2">{t('emptyOrder')}</p>
                                        ) : (
                                            items.slice(0, 10).map((item, idx) => (
                                                <div key={item.product_id} className="flex flex-col mb-2 last:mb-0">
                                                    <div className="flex items-start justify-between text-[11px]">
                                                        <div className="flex items-start gap-2 min-w-0">
                                                            <span className="font-mono font-black text-[var(--accent)] w-7 text-right flex-shrink-0 mt-0.5">
                                                                {item.quantity}×
                                                            </span>
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="font-medium truncate text-[var(--foreground)] opacity-90">
                                                                    {lang === 'km' && item.product_khmer ? item.product_khmer : item.product_name}
                                                                </span>
                                                                <span className="text-[9px] font-mono opacity-40 mt-0.5">
                                                                    {formatUsd(item.price_at_order)} / unit
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <span className="font-mono font-black text-[var(--foreground)] opacity-90 flex-shrink-0 ml-2 mt-0.5">
                                                            {formatUsd(item.price_at_order * item.quantity)}
                                                        </span>
                                                    </div>
                                                </div>
                                            )).concat(items.length > 10 ? [
                                                <div key="more" className="text-center pt-2 text-[9px] font-black uppercase opacity-30">
                                                    + {items.length - 10} more items
                                                </div>
                                            ] : [])
                                        )
                                    ) : (
                                        <div className="flex items-center justify-center py-4 opacity-25">
                                            <RefreshCw size={16} className="animate-spin" />
                                        </div>
                                    )}
                                </div>

                                {/* Customer info for HOLD receipts */}
                                {(g.status === 'hold' || g.status === 'pending_payment') && (() => {
                                    const holdOrder = g.orders[0];
                                    const name = holdOrder?.customer_name;
                                    const phone = holdOrder?.customer_phone;
                                    if (!name && !phone) return null;
                                    return (
                                        <div className="mx-4 mb-2 px-3 py-2 rounded-xl border border-yellow-500/20 bg-yellow-500/5 space-y-1">
                                            {name && <p className="text-[10px] font-black text-yellow-400 uppercase tracking-widest">👤 {name}</p>}
                                            {phone && <p className="text-[10px] font-bold text-yellow-300/70 font-mono">📞 {phone}</p>}
                                        </div>
                                    );
                                })()}

                                {/* Totals */}
                                <div className="px-4 pt-2.5 pb-3 border-t border-dashed border-white/10 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-widest opacity-40">{t('total')}</span>
                                        <span
                                            className="font-mono font-black text-sm text-[var(--accent)]"
                                        >
                                            <span>
                                                {formatUsd(g.total_usd)}
                                            </span>
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-widest opacity-25">{t('khr')}</span>
                                        <span className={`font-mono text-[10px] font-bold opacity-40`}>
                                            {formatKhr(g.total_khr)}
                                        </span>
                                    </div>
                                </div>

                                {/* Print button */}
                                <div className="px-3 pb-3">
                                    <button
                                        onClick={() => {
                                            if (restaurant && isLoaded) {
                                                printReceipt({
                                                    restaurant,
                                                    orderId: g.id,
                                                    tableId: g.table_id || undefined,
                                                    customerName: undefined,
                                                    customerPhone: undefined,
                                                    items,
                                                    payments: [],
                                                    totals: {
                                                        subtotalCents: g.total_usd,
                                                        vatCents: 0,
                                                        pltCents: 0,
                                                        totalUsdCents: g.total_usd,
                                                        totalKhr: g.total_khr
                                                    }
                                                });
                                            }
                                        }}
                                        disabled={!isLoaded || !restaurant}
                                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--accent)] hover:text-black hover:border-[var(--accent)] transition-all font-black text-[10px] uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        <Printer size={11} strokeWidth={2.5} />
                                        {t('printReceipt')}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
                ))}
            </div>
        </div>
    );
}
