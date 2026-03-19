'use client';
import { useState, useEffect, useCallback } from 'react';
import { getKitchenOrders, updateKitchenItemStatus } from '@/lib/tauri-commands';
import type { KitchenOrder, KitchenOrderItem } from '@/types';
import { useLanguage } from '@/providers/LanguageProvider';
import { ChefHat, UtensilsCrossed, CheckCircle2, Clock, RefreshCw, Flame } from 'lucide-react';

// How many seconds between auto-refresh
const POLL_INTERVAL = 8;

type KitchenStatus = KitchenOrderItem['kitchen_status'];

const STATUS_CONFIG: Record<KitchenStatus, {
    label: string; labelKm: string;
    next: KitchenStatus | null; nextLabel: string; nextLabelKm: string;
    cardCls: string; badgeCls: string; Icon: React.ElementType;
}> = {
    pending: {
        label: 'Pending', labelKm: 'រង់ចាំ',
        next: 'cooking', nextLabel: 'Start Cooking', nextLabelKm: 'ចាប់ផ្តើមចំអិន',
        cardCls: 'border-yellow-500/30 bg-yellow-500/5',
        badgeCls: 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30',
        Icon: Clock,
    },
    cooking: {
        label: 'Cooking', labelKm: 'ចំអិន',
        next: 'done', nextLabel: 'Mark Done', nextLabelKm: 'រួចរាល់',
        cardCls: 'border-orange-500/40 bg-orange-500/5',
        badgeCls: 'bg-orange-500/15 text-orange-300 border border-orange-500/30',
        Icon: Flame,
    },
    done: {
        label: 'Done', labelKm: 'រួចរាល់',
        next: null, nextLabel: '', nextLabelKm: '',
        cardCls: 'border-green-500/30 bg-green-500/5',
        badgeCls: 'bg-green-500/15 text-green-300 border border-green-500/30',
        Icon: CheckCircle2,
    },
};

export default function KitchenPage() {
    const { lang } = useLanguage();
    const [orders, setOrders] = useState<KitchenOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [countdown, setCountdown] = useState(POLL_INTERVAL);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        try {
            const data = await getKitchenOrders();
            setOrders(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setCountdown(POLL_INTERVAL);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    // Auto-refresh countdown
    useEffect(() => {
        const tick = setInterval(() => {
            setCountdown(c => {
                if (c <= 1) { refresh(); return POLL_INTERVAL; }
                return c - 1;
            });
        }, 1000);
        return () => clearInterval(tick);
    }, [refresh]);

    async function handleAdvance(item: KitchenOrderItem) {
        const cfg = STATUS_CONFIG[item.kitchen_status];
        if (!cfg.next) return;
        setUpdatingId(item.id);
        try {
            await updateKitchenItemStatus(item.id, cfg.next);
            await refresh();
        } catch (e) {
            console.error(e);
        } finally {
            setUpdatingId(null);
        }
    }

    const totalPending = orders.reduce(
        (sum, o) => sum + o.items.filter(i => i.kitchen_status === 'pending').length, 0
    );
    const totalCooking = orders.reduce(
        (sum, o) => sum + o.items.filter(i => i.kitchen_status === 'cooking').length, 0
    );

    return (
        <div className="h-full flex flex-col bg-[var(--bg-dark)]">
            {/* Header */}
            <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-card)] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-orange-500/15 border border-orange-500/30">
                        <ChefHat size={16} className="text-orange-400" />
                    </div>
                    <div>
                        <h1 className="text-sm font-black text-[var(--foreground)] leading-none">
                            {lang === 'km' ? 'ផ្ទះបាយ' : 'Kitchen Display'}
                        </h1>
                        <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                            {lang === 'km' ? 'ជ្រើសសន្លឹកការងារ' : 'Tap items to advance status'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Pending + Cooking counts */}
                    {totalPending > 0 && (
                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20">
                            <Clock size={11} className="text-yellow-400" />
                            <span className="text-[11px] font-bold text-yellow-300">{totalPending}</span>
                        </div>
                    )}
                    {totalCooking > 0 && (
                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20">
                            <Flame size={11} className="text-orange-400" />
                            <span className="text-[11px] font-bold text-orange-300">{totalCooking}</span>
                        </div>
                    )}

                    {/* Manual refresh + countdown */}
                    <button
                        onClick={() => { setLoading(true); refresh(); }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors"
                        title={lang === 'km' ? 'ធ្វើបច្ចុប្បន្នភាព' : 'Refresh'}
                    >
                        <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
                        <span>{countdown}s</span>
                    </button>
                </div>
            </div>

            {/* Order cards */}
            <div className="flex-1 overflow-y-auto p-3 no-scrollbar">
                {loading && orders.length === 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="rounded-2xl animate-pulse bg-[var(--bg-elevated)] h-48" />
                        ))}
                    </div>
                ) : orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-3 opacity-40">
                        <UtensilsCrossed size={40} className="text-[var(--text-secondary)]" />
                        <p className="text-sm font-semibold text-[var(--text-secondary)]">
                            {lang === 'km' ? 'គ្មានការបញ្ជាទិញតូ' : 'No active orders'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {orders.map(order => (
                            <KitchenOrderCard
                                key={order.order_id}
                                order={order}
                                lang={lang}
                                updatingId={updatingId}
                                onAdvance={handleAdvance}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function KitchenOrderCard({
    order, lang, updatingId, onAdvance,
}: {
    order: KitchenOrder;
    lang: string;
    updatingId: string | null;
    onAdvance: (item: KitchenOrderItem) => void;
}) {
    // Format elapsed time
    const elapsed = (() => {
        const sec = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 1000);
        if (sec < 60) return `${sec}s`;
        const min = Math.floor(sec / 60);
        if (min < 60) return `${min}m`;
        return `${Math.floor(min / 60)}h ${min % 60}m`;
    })();

    const allCooking = order.items.every(i => i.kitchen_status === 'cooking');

    return (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden flex flex-col">
            {/* Card header */}
            <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg-elevated)] border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[var(--accent-blue)]/15 border border-[var(--accent-blue)]/30">
                        <UtensilsCrossed size={13} className="text-[var(--accent-blue)]" />
                    </div>
                    <div>
                        <p className="text-sm font-black text-[var(--foreground)] leading-none">
                            {order.table_id ?? (lang === 'km' ? 'តឡុះ' : 'Takeout')}
                        </p>
                        <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 font-mono">{elapsed}</p>
                    </div>
                </div>
                {allCooking && (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-300">
                        {lang === 'km' ? 'ចំអិន' : 'All cooking'}
                    </span>
                )}
            </div>

            {/* Items */}
            <div className="flex-1 p-2 space-y-1.5">
                {order.items.map(item => {
                    const cfg = STATUS_CONFIG[item.kitchen_status];
                    const StatusIcon = cfg.Icon;
                    const isUpdating = updatingId === item.id;

                    return (
                        <button
                            key={item.id}
                            onClick={() => onAdvance(item)}
                            disabled={!cfg.next || isUpdating}
                            className={`w-full p-2.5 rounded-xl border text-left transition-all active:scale-95 hover:opacity-90 group ${cfg.cardCls} ${!cfg.next ? 'cursor-default' : 'hover:brightness-110'}`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <span className="text-xs font-bold text-[var(--foreground)] truncate">
                                            {lang === 'km' ? (item.product_khmer ?? item.product_name) : item.product_name}
                                        </span>
                                        <span className="text-xs font-black text-[var(--text-secondary)] flex-shrink-0">
                                            ×{item.quantity}
                                        </span>
                                    </div>
                                    {item.note && (
                                        <p className="text-[10px] text-[var(--accent-blue)] italic truncate">
                                            {item.note}
                                        </p>
                                    )}
                                    {/* Status badge + next action hint */}
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 ${cfg.badgeCls}`}>
                                            <StatusIcon size={8} strokeWidth={2.5} />
                                            {lang === 'km' ? cfg.label : cfg.label}
                                        </span>
                                        {cfg.next && !isUpdating && (
                                            <span className="text-[9px] font-semibold text-[var(--text-secondary)] group-hover:text-[var(--foreground)] transition-colors">
                                                → {lang === 'km' ? cfg.nextLabelKm : cfg.nextLabel}
                                            </span>
                                        )}
                                        {isUpdating && (
                                            <RefreshCw size={9} className="text-[var(--text-secondary)] animate-spin" />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
