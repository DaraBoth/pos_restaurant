'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getKitchenOrders, updateKitchenItemStatus } from '@/lib/api/kitchen';
import type { KitchenOrder, KitchenOrderItem } from '@/types';
import { useAuth } from '@/providers/AuthProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import type { TranslationKey } from '@/lib/i18n';
import { ChefHat, UtensilsCrossed, CheckCircle2, Clock, RefreshCw, Flame, LayoutList, Layers, Volume2, VolumeX } from 'lucide-react';

const POLL_INTERVAL = 8;
const MUTE_KEY = 'dineos.kitchen.mute';
type KitchenStatus = KitchenOrderItem['kitchen_status'];

interface AggregatedItem {
    product_name: string;
    product_khmer: string | null;
    pendingItems: KitchenOrderItem[];
    cookingItems: KitchenOrderItem[];
    doneItems: KitchenOrderItem[];
    tableIds: string[];
}

const STATUS_CONFIG = {
    pending: {
        labelKey: 'pending', next: 'cooking', nextLabelKey: 'startCooking',
        cardCls: 'border-yellow-500/30 bg-yellow-500/5', badgeCls: 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30', Icon: Clock,
    },
    cooking: {
        labelKey: 'cooking', next: 'done', nextLabelKey: 'markDone',
        cardCls: 'border-orange-500/40 bg-orange-500/5', badgeCls: 'bg-orange-500/15 text-orange-300 border border-orange-500/30', Icon: Flame,
    },
    done: {
        labelKey: 'done', next: null, nextLabelKey: null,
        cardCls: 'border-green-500/30 bg-green-500/5', badgeCls: 'bg-green-500/15 text-green-300 border border-green-500/30', Icon: CheckCircle2,
    },
} as const;

export default function KitchenPage() {
    const { lang, t } = useLanguage();
    const { user } = useAuth();
    const restaurantId = user?.restaurant_id;
    const [orders, setOrders] = useState<KitchenOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [countdown, setCountdown] = useState(POLL_INTERVAL);
    const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
    const [viewMode, setViewMode] = useState<'summary' | 'tables'>('summary');
    const [muteSound, setMuteSound] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return window.localStorage.getItem(MUTE_KEY) === 'true';
    });
    const muteSoundRef = useRef(muteSound);
    const prevOrderIdsRef = useRef<Set<string> | null>(null);
    const [undoStack, setUndoStack] = useState<Array<{ itemId: string; prevStatus: KitchenStatus }>>([]);

    useEffect(() => { muteSoundRef.current = muteSound; }, [muteSound]);

    function toggleMute() {
        setMuteSound(prev => {
            const next = !prev;
            window.localStorage.setItem(MUTE_KEY, String(next));
            return next;
        });
    }

    function playKitchenAlert() {
        if (muteSoundRef.current || typeof window === 'undefined') return;
        try {
            const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            gain.gain.setValueAtTime(0.35, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.4);
            osc.onended = () => ctx.close();
        } catch (e) {
            console.error('Kitchen alert error:', e);
        }
    }

    const refresh = useCallback(async () => {
        try {
            const data = await getKitchenOrders(restaurantId || undefined);
            const newIds = new Set(data.map((o: KitchenOrder) => o.id));
            if (prevOrderIdsRef.current !== null) {
                let hasNew = false;
                for (const id of newIds) {
                    if (!prevOrderIdsRef.current.has(id)) { hasNew = true; break; }
                }
                if (hasNew) playKitchenAlert();
            }
            prevOrderIdsRef.current = newIds;
            setOrders(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setCountdown(POLL_INTERVAL);
        }
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    useEffect(() => {
        const tick = setInterval(() => {
            setCountdown(c => {
                if (c <= 1) { refresh(); return POLL_INTERVAL; }
                return c - 1;
            });
        }, 1000);
        return () => clearInterval(tick);
    }, [refresh]);

    // Aggregate items by product_name across all orders
    const aggregated = useMemo<AggregatedItem[]>(() => {
        const map = new Map<string, AggregatedItem>();
        for (const order of orders) {
            for (const item of order.items) {
                if (!map.has(item.product_name)) {
                    map.set(item.product_name, {
                        product_name: item.product_name,
                        product_khmer: item.product_khmer ?? null,
                        pendingItems: [],
                        cookingItems: [],
                        doneItems: [],
                        tableIds: [],
                    });
                }
                const entry = map.get(item.product_name)!;
                if (item.kitchen_status === 'pending') entry.pendingItems.push(item);
                else if (item.kitchen_status === 'cooking') entry.cookingItems.push(item);
                else entry.doneItems.push(item);
                if (order.table_id && !entry.tableIds.includes(order.table_id)) {
                    entry.tableIds.push(order.table_id);
                }
            }
        }
        // Sort: pending first, then cooking, then done
        return Array.from(map.values()).sort((a, b) => {
            const scoreA = a.pendingItems.length * 2 + a.cookingItems.length;
            const scoreB = b.pendingItems.length * 2 + b.cookingItems.length;
            return scoreB - scoreA;
        });
    }, [orders]);

    async function handleAdvanceAll(items: KitchenOrderItem[], nextStatus: KitchenStatus) {
        const ids = items.map(i => i.id);
        setUpdatingIds(prev => new Set([...prev, ...ids]));
        try {
            await Promise.all(items.map(i => updateKitchenItemStatus(i.id, nextStatus, restaurantId || '')));
            await refresh();
        } catch (e) {
            console.error(e);
        } finally {
            setUpdatingIds(prev => {
                const next = new Set(prev);
                ids.forEach(id => next.delete(id));
                return next;
            });
        }
    }

    async function handleAdvanceSingle(item: KitchenOrderItem) {
        const cfg = STATUS_CONFIG[item.kitchen_status];
        if (!cfg.next) return;
        const prevStatus = item.kitchen_status;
        setUndoStack(prev => {
            const entry = { itemId: item.id, prevStatus };
            return [entry, ...prev].slice(0, 5);
        });
        setUpdatingIds(prev => new Set([...prev, item.id]));
        try {
            await updateKitchenItemStatus(item.id, cfg.next, restaurantId || '');
            await refresh();
        } catch (e) {
            console.error(e);
        } finally {
            setUpdatingIds(prev => { const s = new Set(prev); s.delete(item.id); return s; });
        }
    }

    async function handleUndo() {
        if (undoStack.length === 0) return;
        const [entry, ...rest] = undoStack;
        setUndoStack(rest);
        setUpdatingIds(prev => new Set([...prev, entry.itemId]));
        try {
            await updateKitchenItemStatus(entry.itemId, entry.prevStatus, restaurantId || '');
            await refresh();
        } catch (e) {
            console.error(e);
        } finally {
            setUpdatingIds(prev => { const s = new Set(prev); s.delete(entry.itemId); return s; });
        }
    }

    const totalPending = aggregated.reduce((s, a) => s + a.pendingItems.length, 0);
    const totalCooking = aggregated.reduce((s, a) => s + a.cookingItems.length, 0);

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
                            {t('kitchenDisplay')}
                        </h1>
                        <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                            {t('tapToAdvance')}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
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

                    {/* Mute toggle */}
                    <button
                        onClick={toggleMute}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-colors ${muteSound ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20' : 'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)]'}`}
                        title={muteSound ? t('soundMuted') : t('soundOn')}
                    >
                        {muteSound ? <VolumeX size={11} /> : <Volume2 size={11} />}
                    </button>

                    {/* Undo button */}
                    {undoStack.length > 0 && (
                        <button
                            onClick={handleUndo}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-[11px] font-semibold text-blue-300 hover:bg-blue-500/20 transition-colors"
                        >
                            <span className="text-[11px]">↩</span>
                            <span>{t('undo')}</span>
                            {undoStack.length > 1 && <span className="ml-0.5 opacity-60">({undoStack.length})</span>}
                        </button>
                    )}

                    {/* View toggle */}
                    <div className="flex items-center gap-0.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-0.5">
                        <button
                            onClick={() => setViewMode('summary')}
                            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all ${viewMode === 'summary' ? 'bg-[var(--accent-blue)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--foreground)]'}`}
                            title={t('summaryView')}
                        >
                            <Layers size={11} />
                        </button>
                        <button
                            onClick={() => setViewMode('tables')}
                            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all ${viewMode === 'tables' ? 'bg-[var(--accent-blue)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--foreground)]'}`}
                            title={t('byTable')}
                        >
                            <LayoutList size={11} />
                        </button>
                    </div>

                    <button
                        onClick={() => { setLoading(true); refresh(); }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors"
                        title={t('refresh')}
                    >
                        <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
                        <span>{countdown}s</span>
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3 no-scrollbar">
                {loading && orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-4 opacity-60">
                        <div className="w-10 h-10 border-2 border-orange-500/20 border-t-orange-400 rounded-full animate-spin" />
                        <div className="text-center">
                            <p className="text-sm font-bold text-[var(--text-secondary)]">
                                {t('connectingKitchen')}
                            </p>
                            <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-40 mt-1 uppercase tracking-widest">
                                {t('firstLoadMoment')}
                            </p>
                        </div>
                    </div>
                ) : aggregated.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-3 opacity-40">
                        <UtensilsCrossed size={40} className="text-[var(--text-secondary)]" />
                        <p className="text-sm font-semibold text-[var(--text-secondary)]">
                            {t('noActiveOrders')}
                        </p>
                    </div>
                ) : viewMode === 'summary' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {aggregated.map(item => (
                            <AggregatedCard
                                key={item.product_name}
                                item={item}
                                lang={lang}
                                updatingIds={updatingIds}
                                onAdvanceAll={handleAdvanceAll}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {orders.map(order => (
                            <KitchenOrderCard
                                key={order.order_id}
                                order={order}
                                lang={lang}
                                updatingIds={updatingIds}
                                onAdvance={handleAdvanceSingle}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Aggregated item card ────────────────────────────────────────────────────
function AggregatedCard({
    item, lang, updatingIds, onAdvanceAll,
}: {
    item: AggregatedItem;
    lang: string;
    updatingIds: Set<string>;
    onAdvanceAll: (items: KitchenOrderItem[], next: KitchenStatus) => void;
}) {
    const pendingQty = item.pendingItems.reduce((s, i) => s + i.quantity, 0);
    const cookingQty = item.cookingItems.reduce((s, i) => s + i.quantity, 0);
    const doneQty    = item.doneItems.reduce((s, i) => s + i.quantity, 0);
    const totalQty   = pendingQty + cookingQty + doneQty;
    const isAnyUpdating = [...item.pendingItems, ...item.cookingItems].some(i => updatingIds.has(i.id));

    const displayName = lang === 'km' ? (item.product_khmer ?? item.product_name) : item.product_name;

    // Determine dominant state for card color
    const cardBorder = item.pendingItems.length > 0
        ? 'border-yellow-500/30 bg-yellow-500/5'
        : item.cookingItems.length > 0
            ? 'border-orange-500/40 bg-orange-500/5'
            : 'border-green-500/30 bg-green-500/5';

    return (
        <div className={`rounded-2xl border overflow-hidden flex flex-col ${cardBorder}`}>
            {/* Header */}
            <div className="px-3 pt-3 pb-2">
                <div className="flex items-start justify-between gap-1 mb-1">
                    <p className={`text-sm font-black text-[var(--foreground)] leading-tight ${lang === 'km' ? 'khmer' : ''}`}>
                        {displayName}
                    </p>
                    <span className="text-lg font-black text-[var(--foreground)] leading-none flex-shrink-0">
                        ×{totalQty}
                    </span>
                </div>

                {/* Tables */}
                {item.tableIds.length > 0 && (
                    <p className="text-[9px] text-[var(--text-secondary)] truncate">
                        {item.tableIds.join(', ')}
                    </p>
                )}
            </div>

            {/* Status breakdown */}
            <div className="px-3 pb-2 flex items-center gap-2">
                {pendingQty > 0 && (
                    <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-yellow-500/15 text-yellow-300 border border-yellow-500/30">
                        <Clock size={8} strokeWidth={2.5} />
                        {pendingQty}
                    </span>
                )}
                {cookingQty > 0 && (
                    <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-orange-500/15 text-orange-300 border border-orange-500/30">
                        <Flame size={8} strokeWidth={2.5} />
                        {cookingQty}
                    </span>
                )}
                {doneQty > 0 && (
                    <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-green-500/15 text-green-300 border border-green-500/30">
                        <CheckCircle2 size={8} strokeWidth={2.5} />
                        {doneQty}
                    </span>
                )}
            </div>
        </div>
    );
}

// ── Per-table order card (detail view) ─────────────────────────────────────
function KitchenOrderCard({
    order, lang, updatingIds, onAdvance,
}: {
    order: KitchenOrder;
    lang: string;
    updatingIds: Set<string>;
    onAdvance: (item: KitchenOrderItem) => void;
}) {
    const { t } = useLanguage();
    const elapsed = (() => {
        // eslint-disable-next-line react-hooks/purity
        const sec = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 1000);
        if (sec < 60) return `${sec}s`;
        const min = Math.floor(sec / 60);
        if (min < 60) return `${min}m`;
        return `${Math.floor(min / 60)}h ${min % 60}m`;
    })();

    const allCooking = order.items.every(i => i.kitchen_status === 'cooking');

    return (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg-elevated)] border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[var(--accent-blue)]/15 border border-[var(--accent-blue)]/30">
                        <UtensilsCrossed size={13} className="text-[var(--accent-blue)]" />
                    </div>
                    <div>
                        <p className="text-sm font-black text-[var(--foreground)] leading-none">
                            {order.table_id ?? t('takeout')}
                        </p>
                        {!order.table_id && order.takeout_counter != null && (
                            <p className="text-lg font-black text-[var(--accent)] leading-none mt-0.5">#{order.takeout_counter}</p>
                        )}
                        <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 font-mono">{elapsed}</p>
                    </div>
                </div>
                {allCooking && (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-300">
                        {t('allCooking')}
                    </span>
                )}
            </div>
            {order.notes && (
                <div className="px-3 py-1.5 bg-[var(--accent-blue)]/10 border-b border-[var(--accent-blue)]/20">
                    <p className="text-[10px] font-bold text-[var(--accent-blue)] italic">{order.notes}</p>
                </div>
            )}

            <div className="flex-1 p-2 space-y-1.5">
                {order.items.map(item => {
                    const cfg = STATUS_CONFIG[item.kitchen_status];
                    const StatusIcon = cfg.Icon;
                    const isUpdating = updatingIds.has(item.id);

                    return (
                        <div
                            key={item.id}
                            className={`w-full p-2.5 rounded-xl border text-left ${cfg.cardCls}`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <span className="text-xs font-bold text-[var(--foreground)] truncate">
                                            {lang === 'km' ? (item.product_khmer ?? item.product_name) : item.product_name}
                                        </span>
                                        <span className="text-xs font-black text-[var(--text-secondary)] flex-shrink-0">×{item.quantity}</span>
                                    </div>
                                    {item.note && (
                                        <p className="text-[10px] text-[var(--accent-blue)] italic truncate">{item.note}</p>
                                    )}
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 ${cfg.badgeCls}`}>
                                            <StatusIcon size={8} strokeWidth={2.5} />
                                            {t(cfg.labelKey as TranslationKey)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
