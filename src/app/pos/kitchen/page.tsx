'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getKitchenOrders, updateKitchenItemStatus } from '@/lib/api/kitchen';
import type { KitchenOrder, KitchenOrderItem } from '@/types';
import { useAuth } from '@/providers/AuthProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import type { TranslationKey } from '@/lib/i18n';
import { ChefHat, UtensilsCrossed, CheckCircle2, Clock, RefreshCw, Flame, LayoutList, Layers, Volume2, VolumeX, Loader2, AlertTriangle } from 'lucide-react';

const POLL_INTERVAL = 8;
const MUTE_KEY = 'dineos.kitchen.mute';
const WARN_MS = 10 * 60 * 1000;
const CRITICAL_MS = 15 * 60 * 1000;
type KitchenStatus = KitchenOrderItem['kitchen_status'];

interface AggregatedItem {
    product_name: string;
    product_khmer: string | null;
    variant_name: string | null;
    modifier_summary: string | null;
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
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [updateError, setUpdateError] = useState<string | null>(null);
    const [now, setNow] = useState<number>(() => Date.now());

    useEffect(() => { muteSoundRef.current = muteSound; }, [muteSound]);

    useEffect(() => {
        const ticker = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(ticker);
    }, []);

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
            const newIds = new Set(data.map((o: KitchenOrder) => o.order_id));
            if (prevOrderIdsRef.current !== null) {
                let hasNew = false;
                for (const id of newIds) {
                    if (!prevOrderIdsRef.current.has(id)) { hasNew = true; break; }
                }
                if (hasNew) playKitchenAlert();
            }
            prevOrderIdsRef.current = newIds;
            setOrders(data);
            setFetchError(null);
        } catch (e) {
            console.error(e);
            setFetchError('Could not reach kitchen data — retrying...');
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
                const key = `${item.product_name}|${item.variant_name ?? ''}|${item.modifier_summary ?? ''}`;
                if (!map.has(key)) {
                    map.set(key, {
                        product_name: item.product_name,
                        product_khmer: item.product_khmer ?? null,
                        variant_name: item.variant_name ?? null,
                        modifier_summary: item.modifier_summary ?? null,
                        pendingItems: [],
                        cookingItems: [],
                        doneItems: [],
                        tableIds: [],
                    });
                }
                const entry = map.get(key)!;
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
            setUpdateError('Update failed — tap again');
            setTimeout(() => setUpdateError(null), 3000);
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
            setUpdateError('Update failed — tap again');
            setTimeout(() => setUpdateError(null), 3000);
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
            <div className="flex-shrink-0 px-4 py-4 border-b border-[var(--border)] bg-[var(--bg-card)] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-orange-500/15 border border-orange-500/30">
                        <ChefHat size={20} className="text-orange-400" />
                    </div>
                    <div>
                        <h1 className="text-sm font-black text-[var(--foreground)] leading-none">
                            {t('kitchenDisplay')}
                        </h1>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                            {t('tapToAdvance')}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {totalPending > 0 && (
                        <div className="flex items-center gap-1 px-3 py-2.5 rounded-full bg-yellow-500/10 border border-yellow-500/20" style={{minHeight:'44px'}}>
                            <Clock size={16} className="text-yellow-400" />
                            <span className="text-sm font-bold text-yellow-300">{totalPending}</span>
                        </div>
                    )}
                    {totalCooking > 0 && (
                        <div className="flex items-center gap-1 px-3 py-2.5 rounded-full bg-orange-500/10 border border-orange-500/20" style={{minHeight:'44px'}}>
                            <Flame size={16} className="text-orange-400" />
                            <span className="text-sm font-bold text-orange-300">{totalCooking}</span>
                        </div>
                    )}

                    {/* Mute toggle */}
                    <button
                        onClick={toggleMute}
                        className={`flex items-center gap-1.5 px-3 py-2.5 rounded-full border text-xs font-semibold transition-colors ${muteSound ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20' : 'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)]'}`}
                        title={muteSound ? t('soundMuted') : t('soundOn')}
                        style={{minHeight:'44px'}}
                    >
                        {muteSound ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>

                    {/* Undo button */}
                    {undoStack.length > 0 && (
                        <button
                            onClick={handleUndo}
                            className="flex items-center gap-1.5 px-3 py-2.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-xs font-semibold text-blue-300 hover:bg-blue-500/20 transition-colors"
                            style={{minHeight:'44px'}}
                        >
                            <span className="text-sm">↩</span>
                            <span>{t('undo')}</span>
                            {undoStack.length > 1 && <span className="ml-0.5 opacity-60">({undoStack.length})</span>}
                        </button>
                    )}

                    {/* View toggle */}
                    <div className="flex items-center gap-0.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-1">
                        <button
                            onClick={() => setViewMode('summary')}
                            className={`flex items-center justify-center p-2.5 rounded-lg transition-all ${viewMode === 'summary' ? 'bg-[var(--accent-blue)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--foreground)]'}`}
                            title={t('summaryView')}
                            style={{minWidth:'44px',minHeight:'44px'}}
                        >
                            <Layers size={16} />
                        </button>
                        <button
                            onClick={() => setViewMode('tables')}
                            className={`flex items-center justify-center p-2.5 rounded-lg transition-all ${viewMode === 'tables' ? 'bg-[var(--accent-blue)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--foreground)]'}`}
                            title={t('byTable')}
                            style={{minWidth:'44px',minHeight:'44px'}}
                        >
                            <LayoutList size={16} />
                        </button>
                    </div>

                    <button
                        onClick={() => { setLoading(true); refresh(); }}
                        className="flex items-center gap-1.5 px-3 py-2.5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors"
                        title={t('refresh')}
                        style={{minHeight:'44px'}}
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        <span>{countdown}s</span>
                    </button>
                </div>
            </div>

            {/* Fetch error banner */}
            {fetchError && (
                <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-red-500/15 border-b border-red-500/30 text-red-300 text-xs font-bold">
                    <AlertTriangle size={13} className="flex-shrink-0" />
                    <span className="flex-1">{fetchError}</span>
                    <button onClick={() => setFetchError(null)} className="text-red-400 hover:text-red-200"><span>✕</span></button>
                </div>
            )}
            {/* Update error banner */}
            {updateError && (
                <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-orange-500/15 border-b border-orange-500/30 text-orange-300 text-xs font-bold">
                    <AlertTriangle size={13} className="flex-shrink-0" />
                    <span>{updateError}</span>
                </div>
            )}

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
                                key={`${item.product_name}|${item.variant_name ?? ''}|${item.modifier_summary ?? ''}`}
                                item={item}
                                lang={lang}
                                updatingIds={updatingIds}
                                onAdvanceAll={handleAdvanceAll}
                                now={now}
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
                                now={now}
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
    item, lang, updatingIds, onAdvanceAll, now,
}: {
    item: AggregatedItem;
    lang: string;
    updatingIds: Set<string>;
    onAdvanceAll: (items: KitchenOrderItem[], next: KitchenStatus) => void;
    now: number;
}) {
    const { t } = useLanguage();
    const pendingQty = item.pendingItems.reduce((s, i) => s + i.quantity, 0);
    const cookingQty = item.cookingItems.reduce((s, i) => s + i.quantity, 0);
    const doneQty    = item.doneItems.reduce((s, i) => s + i.quantity, 0);
    const totalQty   = pendingQty + cookingQty + doneQty;
    const isAnyUpdating = [...item.pendingItems, ...item.cookingItems].some(i => updatingIds.has(i.id));

    const displayName = (lang === 'km' ? (item.product_khmer ?? item.product_name) : item.product_name)
        + (item.variant_name ? ` - ${item.variant_name}` : '')
        + (item.modifier_summary ? ` (${item.modifier_summary})` : '');

    // Urgency: based on the oldest pending/cooking item
    const activeItems = [...item.pendingItems, ...item.cookingItems];
    const oldestMs = activeItems.length > 0
        ? Math.min(...activeItems.map(i => new Date(i.created_at).getTime()))
        : null;
    const age = oldestMs != null ? now - oldestMs : 0;
    const isCritical = activeItems.length > 0 && age >= CRITICAL_MS;
    const isWarn = activeItems.length > 0 && !isCritical && age >= WARN_MS;

    const cardBorder = isCritical
        ? 'border-red-500/60 bg-red-500/10 animate-pulse'
        : isWarn
            ? 'border-amber-500/50 bg-amber-500/8'
            : item.pendingItems.length > 0
                ? 'border-yellow-500/30 bg-yellow-500/5'
                : item.cookingItems.length > 0
                    ? 'border-orange-500/40 bg-orange-500/5'
                    : 'border-green-500/30 bg-green-500/5';

    // Determine advance action
    const actionItems = item.pendingItems.length > 0 ? item.pendingItems : item.cookingItems;
    const nextStatus = item.pendingItems.length > 0 ? 'cooking' : item.cookingItems.length > 0 ? 'done' : null;
    const nextLabelKey = item.pendingItems.length > 0 ? 'startCooking' : 'markDone';

    return (
        <div className={`rounded-2xl border overflow-hidden flex flex-col ${cardBorder}`}>
            {/* Header */}
            <div className="px-3 pt-3 pb-2">
                <div className="flex items-start justify-between gap-1 mb-1">
                    <p className={`text-base font-black text-[var(--foreground)] leading-tight ${lang === 'km' ? 'khmer' : ''}`}>
                        {displayName}
                    </p>
                    <span className={`text-2xl font-black leading-none flex-shrink-0 ${isCritical ? 'text-red-300' : 'text-[var(--foreground)]'}`}>
                        ×{totalQty}
                    </span>
                </div>

                {/* Tables */}
                {item.tableIds.length > 0 && (
                    <p className="text-xs font-semibold text-[var(--text-secondary)] truncate">
                        {item.tableIds.join(', ')}
                    </p>
                )}
            </div>

            {/* Status breakdown */}
            <div className="px-3 pb-2 flex items-center gap-2">
                {pendingQty > 0 && (
                    <span className="flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded-md bg-yellow-500/15 text-yellow-300 border border-yellow-500/30">
                        <Clock size={14} strokeWidth={2.5} />
                        {pendingQty}
                    </span>
                )}
                {cookingQty > 0 && (
                    <span className="flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded-md bg-orange-500/15 text-orange-300 border border-orange-500/30">
                        <Flame size={14} strokeWidth={2.5} />
                        {cookingQty}
                    </span>
                )}
                {doneQty > 0 && (
                    <span className="flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded-md bg-green-500/15 text-green-300 border border-green-500/30">
                        <CheckCircle2 size={14} strokeWidth={2.5} />
                        {doneQty}
                    </span>
                )}
            </div>

            {/* Advance button */}
            {nextStatus && (
                <div className="px-3 pb-3 mt-auto">
                    <button
                        onClick={() => onAdvanceAll(actionItems, nextStatus as KitchenStatus)}
                        disabled={isAnyUpdating}
                        className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-black transition-all active:scale-95 disabled:opacity-50
                            ${nextStatus === 'cooking'
                                ? 'bg-orange-500/20 border border-orange-500/40 text-orange-300 hover:bg-orange-500/30'
                                : 'bg-green-500/20 border border-green-500/40 text-green-300 hover:bg-green-500/30'}`}
                    >
                        {isAnyUpdating
                            ? <Loader2 size={14} className="animate-spin" />
                            : t(nextLabelKey as TranslationKey)}
                    </button>
                </div>
            )}
        </div>
    );
}

// ── Per-table order card (detail view) ─────────────────────────────────────
function KitchenOrderCard({
    order, lang, updatingIds, onAdvance, now,
}: {
    order: KitchenOrder;
    lang: string;
    updatingIds: Set<string>;
    onAdvance: (item: KitchenOrderItem) => void;
    now: number;
}) {
    const { t } = useLanguage();

    const sec = Math.floor((now - new Date(order.created_at).getTime()) / 1000);
    const elapsed = sec < 60 ? `${sec}s` : sec < 3600 ? `${Math.floor(sec / 60)}m` : `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;

    const age = now - new Date(order.created_at).getTime();
    const hasActive = order.items.some(i => i.kitchen_status !== 'done');
    const isCritical = hasActive && age >= CRITICAL_MS;
    const isWarn = hasActive && !isCritical && age >= WARN_MS;

    const allCooking = order.items.every(i => i.kitchen_status === 'cooking');

    const headerCls = isCritical
        ? 'bg-red-500/15 border-b border-red-500/30 animate-pulse'
        : isWarn
            ? 'bg-amber-500/10 border-b border-amber-500/30'
            : 'bg-[var(--bg-elevated)] border-b border-[var(--border)]';

    return (
        <div className={`rounded-2xl border overflow-hidden flex flex-col ${isCritical ? 'border-red-500/40' : isWarn ? 'border-amber-500/30' : 'border-[var(--border)]'} bg-[var(--bg-card)]`}>
            <div className={`flex items-center justify-between px-3 py-2.5 ${headerCls}`}>
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--accent-blue)]/15 border border-[var(--accent-blue)]/30">
                        <UtensilsCrossed size={15} className="text-[var(--accent-blue)]" />
                    </div>
                    <div>
                        <p className="text-base font-black text-[var(--foreground)] leading-none">
                            {order.table_id ?? t('takeout')}
                        </p>
                        {!order.table_id && order.takeout_counter != null && (
                            <p className="text-lg font-black text-[var(--accent)] leading-none mt-0.5">#{order.takeout_counter}</p>
                        )}
                        <p className={`text-xs font-mono mt-0.5 ${isCritical ? 'text-red-300 font-black' : 'text-[var(--text-secondary)]'}`}>{elapsed}</p>
                    </div>
                </div>
                {allCooking && (
                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-300">
                        {t('allCooking')}
                    </span>
                )}
            </div>
            {order.notes && (
                <div className="px-3 py-1.5 bg-[var(--accent-blue)]/10 border-b border-[var(--accent-blue)]/20">
                    <p className="text-xs font-bold text-[var(--accent-blue)] italic">{order.notes}</p>
                </div>
            )}

            <div className="flex-1 p-2 space-y-1.5">
                {order.items.map(item => {
                    const cfg = STATUS_CONFIG[item.kitchen_status];
                    const StatusIcon = cfg.Icon;
                    const isUpdating = updatingIds.has(item.id);
                    const canAdvance = cfg.next !== null;

                    return (
                        <button
                            key={item.id}
                            onClick={() => canAdvance && onAdvance(item)}
                            disabled={isUpdating || !canAdvance}
                            className={`w-full p-3 rounded-xl border text-left transition-all active:scale-[0.98] ${cfg.cardCls} ${canAdvance ? 'cursor-pointer hover:brightness-110' : 'cursor-default'} disabled:opacity-60`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-base font-black text-[var(--foreground)] truncate ${lang === 'km' ? 'khmer' : ''}`}>
                                            {(lang === 'km' ? (item.product_khmer ?? item.product_name) : item.product_name)}{item.variant_name ? ` - ${item.variant_name}` : ''}{item.modifier_summary ? ` (${item.modifier_summary})` : ''}
                                        </span>
                                        <span className="text-xl font-black text-[var(--text-secondary)] flex-shrink-0">×{item.quantity}</span>
                                    </div>
                                    {item.note && (
                                        <p className="text-xs text-[var(--accent-blue)] italic truncate">{item.note}</p>
                                    )}
                                    <div className="flex items-center gap-1.5 mt-1">
                                        {isUpdating ? (
                                            <Loader2 size={14} className="animate-spin text-[var(--text-secondary)]" />
                                        ) : (
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${cfg.badgeCls}`}>
                                                <StatusIcon size={14} strokeWidth={2.5} />
                                                {t(cfg.labelKey as TranslationKey)}
                                            </span>
                                        )}
                                        {canAdvance && !isUpdating && cfg.nextLabelKey && (
                                            <span className="text-[10px] text-[var(--text-secondary)] opacity-60">→ {t(cfg.nextLabelKey as TranslationKey)}</span>
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
