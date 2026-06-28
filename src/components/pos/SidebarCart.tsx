'use client';
import { useOrder } from '@/providers/OrderProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { useAuth } from '@/providers/AuthProvider';
import { updateOrderItemQuantity, updateOrderItemNote, voidOrder, getOrderItems, addRound, getSessionRounds, getRestaurant, getSessionOrderItems } from '@/lib/tauri-commands';
import { getOrders, getHeldOrders, resumeOrder } from '@/lib/api/orders';
import type { HeldOrderSummary } from '@/lib/api/orders';
import { getRevenueSummary } from '@/lib/api/analytics';
import type { OrderItem, RevenueSummary } from '@/types';
import { formatUsd, formatKhr, calculateTotals, roundKhr } from '@/lib/currency';
import { useEffect, useState, useRef } from 'react';
import { Trash2, ShoppingCart, Plus, Minus, History, CreditCard, XCircle, Pencil, StickyNote, PauseCircle, ClipboardList, Loader2, Check, ChevronLeft, ChevronRight, Printer, X } from 'lucide-react';
import TableOrderHistoryModal from '@/components/pos/TableOrderHistoryModal';
import { printReceipt, ReceiptPrintPayload } from '@/lib/receipt';
import { getImageSrc } from '@/lib/image';
import { canVoidOrder } from '@/lib/permissions';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Toast from '@/components/ui/Toast';

// English value is stored as the canonical void_reason for audit consistency
// regardless of the cashier's UI language; the i18n key drives the display label.
const VOID_REASONS = [
    { value: 'Wrong order', key: 'voidReasonWrongOrder' as const },
    { value: 'Customer cancelled', key: 'voidReasonCustomerCancelled' as const },
    { value: 'Test order', key: 'voidReasonTestOrder' as const },
    { value: 'Other', key: 'voidReasonOther' as const },
];

export default function SidebarCart({ onCheckout, onHold, isTakeout }: { onCheckout: () => void; onHold: () => void; isTakeout?: boolean }) {
    const { items, totals, orderId, tableId, clearOrder, setItems, rounds, switchRound, sessionId, setRounds,
        localCart, addToLocalCart, updateLocalCartQty, setLocalCartItemNote, commitLocalCart, exchangeRate, rateIsDefault,
        orderNote, setOrderNote, setOrderId } = useOrder();
    const { t, lang } = useLanguage();
    const { user } = useAuth();
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [showVoidConfirm, setShowVoidConfirm] = useState(false);
    const [voidReason, setVoidReason] = useState('');
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [noteInput, setNoteInput] = useState('');
    const [localNoteProductId, setLocalNoteProductId] = useState<string | null>(null);
    const [localNoteInput, setLocalNoteInput] = useState('');
    const [committing, setCommitting] = useState(false);
    const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
    const [todaySummary, setTodaySummary] = useState<RevenueSummary | null>(null);
    const [takeoutCounter, setTakeoutCounter] = useState<number | null>(null);
    const [heldOrders, setHeldOrders] = useState<HeldOrderSummary[]>([]);
    const [showHeldDrawer, setShowHeldDrawer] = useState(false);
    const [resumingId, setResumingId] = useState<string | null>(null);
    const [pendingResume, setPendingResume] = useState<HeldOrderSummary | null>(null);
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
    const [removingItemId, setRemovingItemId] = useState<string | null>(null);
    const removeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const roundsScrollRef = useRef<HTMLDivElement>(null);

    const scrollRounds = (dir: 'left' | 'right') => {
        if (roundsScrollRef.current) {
            roundsScrollRef.current.scrollBy({ left: dir === 'left' ? -150 : 150, behavior: 'smooth' });
        }
    };

    useEffect(() => {
        setQuantityDrafts(prev => {
            const next = { ...prev };

            for (const item of localCart) {
                next[`local-${item.productId}|${item.variantId || ''}|${(item.modifierOptionIds || []).join(',')}`] = String(item.qty);
            }

            for (const item of items) {
                next[item.id] = String(item.quantity);
            }

            return next;
        });
    }, [items, localCart]);

    const isAdmin = user?.role === 'admin';

    useEffect(() => {
        if (!isAdmin || !user?.restaurant_id) return;
        getRevenueSummary(user.restaurant_id)
            .then(setTodaySummary)
            .catch(console.error);
    }, [isAdmin, user?.restaurant_id, orderId]);

    useEffect(() => {
        if (!orderId || tableId || !user?.restaurant_id) { setTakeoutCounter(null); return; }
        getOrders('open', undefined, undefined, user.restaurant_id)
            .then(orders => {
                const match = orders.find(o => o.id === orderId);
                setTakeoutCounter(match?.takeout_counter ?? null);
            })
            .catch(() => {});
    }, [orderId, tableId, user?.restaurant_id]);

    const refreshHeldOrders = () => {
        if (!user?.restaurant_id) return;
        getHeldOrders(user.restaurant_id).then(setHeldOrders).catch(() => {});
    };

    useEffect(() => {
        refreshHeldOrders();
    }, [orderId, user?.restaurant_id]); // eslint-disable-line react-hooks/exhaustive-deps

    function handleResumeOrder(held: HeldOrderSummary) {
        if ((items.length > 0 || localCart.length > 0) && orderId !== held.id) {
            setPendingResume(held);
            return;
        }
        doResumeOrder(held);
    }

    async function doResumeOrder(held: HeldOrderSummary) {
        setPendingResume(null);
        setResumingId(held.id);
        try {
            const order = await resumeOrder(held.id, user?.restaurant_id || '');
            const orderItems = await getOrderItems(held.id, user?.restaurant_id || '');
            setOrderId(order.id);
            setItems(orderItems);
            setShowHeldDrawer(false);
            refreshHeldOrders();
        } catch (e) {
            console.error('Resume order failed:', e);
            setToast({ msg: t('failedResumeOrder'), ok: false });
        } finally {
            setResumingId(null);
        }
    }


    async function handleNoteSave(id: string) {
        try {
            await updateOrderItemNote(id, noteInput.trim() || undefined, user?.restaurant_id || '');
            if (orderId) {
                const updated = await getOrderItems(orderId, user?.restaurant_id || '');
                setItems(updated);
            }
        } catch (e) {
            console.error(e);
            setToast({ msg: t('genericError'), ok: false });
        } finally {
            setEditingNoteId(null);
        }
    }

    async function handleQtyChange(id: string, current: number, delta: number) {
        if (!orderId) return;
        const nextQty = current + delta;
        if (nextQty < 0) return;
        try {
            await updateOrderItemQuantity(id, nextQty, user?.restaurant_id || '');
            const updated = await getOrderItems(orderId, user?.restaurant_id || '');
            setItems(updated);
        } catch (e) {
            console.error(e);
            setToast({ msg: t('genericError'), ok: false });
        }
    }

    async function handleCommittedQtySet(id: string, rawValue: string, fallbackQty: number) {
        if (!orderId) return;

        const trimmed = rawValue.trim();
        const parsed = Number.parseInt(trimmed, 10);

        if (!trimmed || Number.isNaN(parsed)) {
            setQuantityDrafts(prev => ({ ...prev, [id]: String(fallbackQty) }));
            return;
        }

        const nextQty = Math.max(0, parsed);

        try {
            await updateOrderItemQuantity(id, nextQty, user?.restaurant_id || '');
            const updated = await getOrderItems(orderId, user?.restaurant_id || '');
            setItems(updated);
        } catch (e) {
            console.error(e);
            setQuantityDrafts(prev => ({ ...prev, [id]: String(fallbackQty) }));
        }
    }

    function handleLocalQtySet(productId: string, rawValue: string, fallbackQty: number, variantId?: string, modifierKey?: string) {
        const draftKey = `local-${productId}|${variantId || ''}|${modifierKey || ''}`;
        const trimmed = rawValue.trim();
        const parsed = Number.parseInt(trimmed, 10);

        if (!trimmed || Number.isNaN(parsed)) {
            setQuantityDrafts(prev => ({ ...prev, [draftKey]: String(fallbackQty) }));
            return;
        }

        updateLocalCartQty(productId, Math.max(0, parsed), variantId, modifierKey);
    }

    async function handleVoid() {
        setVoidReason('');
        setShowVoidConfirm(true);
    }

    async function confirmVoid() {
        if (!orderId || !voidReason) return;
        setShowVoidConfirm(false);
        try {
            await voidOrder(orderId, user?.restaurant_id || '', user?.id || '', voidReason);
            clearOrder();
        } catch (e) {
            console.error(e);
            setToast({ msg: t('failedVoidOrder'), ok: false });
        }
    }

    async function handleAddRound() {
        if (!user || !sessionId) return;
        try {
            const newOrderId = await addRound(user.id, sessionId, user.restaurant_id);
            const newRounds = await getSessionRounds(sessionId, user.restaurant_id);
            setRounds(newRounds);
            await switchRound(newOrderId);
        } catch (e) {
            console.error('Failed to add round', e);
            setToast({ msg: t('failedAddRound'), ok: false });
        }
    }

    const isEmpty = (items?.length || 0) === 0;
    const totalQty = items.reduce((s, i) => s + i.quantity, 0);
    const localCartTotalCents = localCart.reduce((s, i) => s + i.priceCents * i.qty, 0);
    const localCartTotalQty = localCart.reduce((s, i) => s + i.qty, 0);
    const displayKhr = orderId
        ? totals.totalKhr
        : (exchangeRate > 0 ? roundKhr(localCartTotalCents, exchangeRate) : 0);

    async function handlePrintReceipt() {
        if (!user || !user.restaurant_id) return;
        try {
            const restaurant = await getRestaurant(user.restaurant_id);

            let receiptItems = items;
            let receiptTotals = totals;

            if (sessionId) {
                // Fetch all items from all rounds in the session
                const allItems = await getSessionOrderItems(sessionId, user.restaurant_id!);

                // Group by product_id to combine same items from different rounds
                const groupedMap = new Map<string, OrderItem>();
                for (const item of allItems) {
                    if (groupedMap.has(item.product_id)) {
                        const existing = groupedMap.get(item.product_id)!;
                        existing.quantity += item.quantity;
                    } else {
                        groupedMap.set(item.product_id, { ...item });
                    }
                }
                receiptItems = Array.from(groupedMap.values());

                const subtotal = receiptItems.reduce((sum, item) => sum + (item.price_at_order * item.quantity), 0);
                receiptTotals = calculateTotals(subtotal, exchangeRate, (restaurant.vat_enabled ?? 0) === 1);
            } else if (!orderId && localCart.length > 0) {
                // Map local cart to OrderItem for preview
                receiptItems = localCart.map(i => ({
                    id: `local-${i.productId}-${i.variantId ?? ''}`,
                    order_id: 'PREVIEW',
                    product_id: i.productId,
                    product_name: i.productName,
                    product_khmer: i.khmerName,
                    variant_name: i.variantName,
                    modifiers: (i.modifierLabel ? i.modifierLabel.split(', ').map(n => ({ name: n })) : undefined),
                    quantity: i.qty,
                    price_at_order: i.priceCents,
                    total_at_order: i.priceCents * i.qty,
                    status: 'pending',
                    created_at: new Date().toISOString()
                })) as unknown as typeof receiptItems;

                receiptTotals = {
                    subtotalCents: localCartTotalCents,
                    vatCents: 0,
                    pltCents: 0,
                    totalUsdCents: localCartTotalCents,
                    totalKhr: roundKhr(localCartTotalCents, exchangeRate)
                };
            }

            if (receiptItems.length === 0) return;

            const payload: ReceiptPrintPayload = {
                restaurant,
                orderId: orderId || 'PREVIEW',
                tableId: tableId || undefined,
                items: receiptItems,
                payments: [], // Preview has no payments yet
                totals: receiptTotals,
                orderNotes: orderNote || undefined,
            };

            printReceipt(payload);
        } catch (e) {
            console.error('Failed to print receipt', e);
        }
    }

    async function handlePlaceOrder() {
        if (!user || localCart.length === 0) return;
        setCommitting(true);
        try {
            await commitLocalCart(user.id);
        } catch (e) {
            console.error('Failed to place order', e);
            setToast({ msg: t('failedPlaceOrder'), ok: false });
        } finally {
            setCommitting(false);
        }
    }

    return (
        <>
            <div
                className="flex-shrink-0 flex flex-col min-h-0 bg-[var(--bg-card)] border-l border-y border-[var(--border)] overflow-hidden"
                style={{ width: 'var(--sidebar-cart-width)', boxShadow: 'inset 0 0 0 1px var(--border)' }}
            >
                {/* Header */}
                <div className="flex-shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-[var(--border)] bg-[var(--bg-elevated)]">
                    <div className="flex items-center gap-2">
                        <ShoppingCart size={18} className="text-[var(--accent)]" />
                        <span className="text-xs font-bold text-[var(--foreground)]">
                            {t('currentOrder')}
                        </span>
                        {(orderId ? totalQty : localCartTotalQty) > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[var(--accent)] text-white">
                                {orderId ? totalQty : localCartTotalQty}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        {tableId && (
                            <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-[var(--bg-dark)] border border-[var(--border)] text-[var(--accent-blue)]">
                                {tableId}
                            </span>
                        )}
                        {!tableId && orderId && takeoutCounter != null && (
                            <span className="text-base font-black px-3 py-1 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent)] tracking-wider">
                                {t('takeoutCounter')}{takeoutCounter}
                            </span>
                        )}
                        {tableId && (
                            <button
                                onClick={() => setIsHistoryOpen(true)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--accent-blue)]/20 text-[var(--text-secondary)] hover:text-[var(--accent-blue)]"
                                title={t('history')}
                            >
                                <History size={13} />
                            </button>
                        )}
                        <button
                            onClick={() => { refreshHeldOrders(); setShowHeldDrawer(true); }}
                            className="relative w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-amber-500/20 text-[var(--text-secondary)] hover:text-amber-400"
                            title={t('heldOrders')}
                        >
                            <PauseCircle size={13} />
                            {heldOrders.length > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-amber-500 text-[8px] font-black text-black px-0.5">
                                    {heldOrders.length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={handlePrintReceipt}
                            disabled={orderId ? isEmpty : localCart.length === 0}
                            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--accent)]/20 text-[var(--accent)] disabled:opacity-30"
                            title={t('printReceipt')}
                        >
                            <Printer size={13} />
                        </button>
                    </div>
                </div>

                {/* Today's Sales widget — admin/owner only */}
                {isAdmin && todaySummary && (
                    <div className="flex-shrink-0 flex items-center justify-between px-3 py-1.5 border-b border-[var(--border)] bg-[var(--bg-dark)]/60 gap-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60 whitespace-nowrap">
                            {t('today') ?? 'Today'}
                        </span>
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="text-center">
                                <p className="text-[9px] text-[var(--text-secondary)] opacity-50 uppercase tracking-widest">{t('orders') ?? 'Orders'}</p>
                                <p className="text-xs font-black text-[var(--foreground)] font-mono">{todaySummary.today_orders}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-[9px] text-[var(--text-secondary)] opacity-50 uppercase tracking-widest">{t('revenue') ?? 'Revenue'}</p>
                                <p className="text-xs font-black text-[var(--accent-green)] font-mono">{formatUsd(todaySummary.today_usd)}</p>
                                {exchangeRate > 0 && (
                                    <p className="text-[9px] text-white/30 font-mono">{formatKhr(roundKhr(todaySummary.today_usd, exchangeRate))}</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Rounds Scroller (only for table sessions) */}
                {tableId && sessionId && rounds.length > 0 && (
                    <div className="flex-shrink-0 relative bg-[var(--bg-elevated)] border-b border-[var(--border)] group/rounds">
                        <button
                            onClick={() => scrollRounds('left')}
                            className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-[var(--bg-elevated)] to-transparent flex items-center justify-start opacity-0 group-hover/rounds:opacity-100 transition-opacity z-10"
                        >
                            <ChevronLeft size={16} className="text-[var(--text-secondary)] hover:text-white ml-0.5 bg-[var(--bg-dark)]/80 rounded-full" />
                        </button>

                        <div
                            ref={roundsScrollRef}
                            className="px-2 py-1.5 overflow-x-auto no-scrollbar flex items-center gap-1.5 snap-x"
                        >
                            {rounds.map(round => {
                                const isActive = round.id === orderId;
                                return (
                                    <button
                                        key={round.id}
                                        onClick={() => switchRound(round.id)}
                                        className={`snap-start flex-shrink-0 px-4 py-3 rounded-xl text-sm font-bold tracking-wide transition-all ${isActive
                                            ? 'bg-[var(--accent-blue)] text-white shadow-sm'
                                            : 'bg-[var(--bg-dark)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:border-[var(--accent-blue)]/50'
                                            }`}
                                    >
                                        {t('round')} {round.round_number}
                                        {isActive && <span className="ml-1.5 opacity-80">({t('view')})</span>}
                                    </button>
                                );
                            })}
                            <button
                                onClick={handleAddRound}
                                className="snap-start flex-shrink-0 px-4 py-3 rounded-xl text-sm font-bold tracking-wide text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors flex items-center gap-2"
                            >
                                <Plus size={14} strokeWidth={3} />
                                {t('newRound')}
                            </button>
                        </div>

                        <button
                            onClick={() => scrollRounds('right')}
                            className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-[var(--bg-elevated)] to-transparent flex items-center justify-end opacity-0 group-hover/rounds:opacity-100 transition-opacity z-10"
                        >
                            <ChevronRight size={16} className="text-[var(--text-secondary)] hover:text-white mr-0.5 bg-[var(--bg-dark)]/80 rounded-full" />
                        </button>
                    </div>
                )}

                {/* Items List */}
                <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5 min-h-0 no-scrollbar bg-[var(--bg-dark)] border-l border-[var(--border)]">
                    {/* ── LOCAL CART (before order is placed) ── */}
                    {!orderId && localCart.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center gap-2 opacity-30">
                            <ShoppingCart size={28} className="text-[var(--text-secondary)]" />
                            <p className="text-xs font-semibold text-[var(--text-secondary)] text-center">
                                {t('emptyOrder')}
                            </p>
                        </div>
                    )}
                    {!orderId && localCart.map(item => {
                      const modKey = (item.modifierOptionIds || []).join(',');
                      const lineKey = `${item.productId}|${item.variantId || ''}|${modKey}`;
                      const draftKey = `local-${lineKey}`;
                      const variantLabel = lang === 'km' ? (item.variantNameKm || item.variantName) : item.variantName;
                      return (
                        <div key={lineKey} className="rounded-none border bg-[var(--bg-elevated)] border-[var(--border-strong)] overflow-hidden">
                            <div className="flex gap-2.5 p-2.5 items-start">
                                {/* Thumbnail */}
                                <div className="w-24 h-24 shrink-0 rounded-xl overflow-hidden bg-[var(--bg-dark)] border border-[var(--border)]">
                                    {getImageSrc(item.imagePath) ? (
                                        <img src={getImageSrc(item.imagePath)!} alt={item.productName} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-[var(--text-secondary)] opacity-30 text-lg font-black">
                                            {item.productName.charAt(0)}
                                        </div>
                                    )}
                                </div>
                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start gap-1 mb-1">
                                        <div className="min-w-0">
                                            <p className={`text-sm font-bold text-[var(--foreground)] truncate leading-tight ${lang === 'km' ? 'khmer' : ''}`}>
                                                {lang === 'km' ? (item.khmerName || item.productName) : item.productName}
                                            </p>
                                            {variantLabel && (
                                                <p className={`text-[11px] font-semibold text-[var(--accent-blue)] truncate leading-tight ${lang === 'km' ? 'khmer' : ''}`}>
                                                    {variantLabel}
                                                </p>
                                            )}
                                            {item.modifierLabel && (
                                                <p className="text-[10px] font-medium text-[var(--text-secondary)] truncate leading-tight">
                                                    {item.modifierLabel}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <span className="text-sm font-bold font-mono text-[var(--accent-green)]">
                                                {formatUsd(item.priceCents * item.qty)}
                                            </span>
                                            <button
                                                onClick={() => updateLocalCartQty(item.productId, 0, item.variantId, modKey)}
                                                className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-secondary)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                                title={t('removeItem')}
                                            >
                                                <X size={13} strokeWidth={2.5} />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-xs font-mono text-[var(--text-secondary)] mb-2">
                                        {formatUsd(item.priceCents)}
                                    </p>
                                    <div className="flex items-center gap-1 p-0 rounded-lg bg-[var(--bg-dark)] border border-[var(--border)] min-h-10">
                                        <button
                                            onClick={() => updateLocalCartQty(item.productId, item.qty - 1, item.variantId, modKey)}
                                            className="w-10 h-10 flex items-center justify-center rounded-lg transition-colors hover:bg-red-500/20 text-[var(--text-secondary)] hover:text-red-400"
                                        >
                                            {item.qty <= 1 ? <Trash2 size={16} /> : <Minus size={16} />}
                                        </button>
                                        <input
                                            type="number"
                                            min="0"
                                            inputMode="numeric"
                                            value={quantityDrafts[draftKey] ?? String(item.qty)}
                                            onChange={(e) => setQuantityDrafts(prev => ({ ...prev, [draftKey]: e.target.value }))}
                                            onBlur={(e) => handleLocalQtySet(item.productId, e.target.value, item.qty, item.variantId, modKey)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.currentTarget.blur();
                                                }
                                                if (e.key === 'Escape') {
                                                    setQuantityDrafts(prev => ({ ...prev, [draftKey]: String(item.qty) }));
                                                    e.currentTarget.blur();
                                                }
                                            }}
                                            className="font-bold font-mono text-lg flex-1 min-w-0 text-center text-[var(--foreground)] bg-transparent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                        />
                                        <button
                                            onClick={() => updateLocalCartQty(item.productId, item.qty + 1, item.variantId, modKey)}
                                            className="w-10 h-10 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--accent-green)]/20 text-[var(--accent-green)]"
                                        >
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                    {localNoteProductId === lineKey ? (
                                        <div className="mt-1.5 flex items-center gap-1">
                                            <StickyNote size={10} className="text-[var(--accent-blue)] flex-shrink-0" />
                                            <input
                                                autoFocus
                                                type="text"
                                                value={localNoteInput}
                                                onChange={e => setLocalNoteInput(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter' || e.key === 'Escape') {
                                                        setLocalCartItemNote(item.productId, localNoteInput.trim(), item.variantId, modKey);
                                                        setLocalNoteProductId(null);
                                                    }
                                                }}
                                                onBlur={() => {
                                                    setLocalCartItemNote(item.productId, localNoteInput.trim(), item.variantId, modKey);
                                                    setLocalNoteProductId(null);
                                                }}
                                                placeholder={t('itemNote') + '...'}
                                                className="flex-1 text-[10px] bg-[var(--bg-dark)] border border-[var(--accent-blue)]/40 rounded-md px-1.5 py-0.5 text-[var(--foreground)] placeholder:text-[var(--text-secondary)] outline-none focus:border-[var(--accent-blue)]/70"
                                            />
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => { setLocalNoteProductId(lineKey); setLocalNoteInput(item.note ?? ''); }}
                                            className="mt-1 flex items-center gap-1 text-[10px] text-[var(--text-secondary)] hover:text-[var(--accent-blue)] transition-colors"
                                        >
                                            <Pencil size={9} />
                                            {item.note
                                                ? <span className="italic text-[var(--accent-blue)] truncate max-w-[120px]">{item.note}</span>
                                                : <span>{t('addNote')}</span>
                                            }
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                      );
                    })}
                    {/* ── COMMITTED ORDER (after Place Order) ── */}
                    {orderId && isEmpty && (
                        <div className="h-full flex flex-col items-center justify-center gap-2 opacity-30">
                            <ShoppingCart size={28} className="text-[var(--text-secondary)]" />
                            <p className="text-xs font-semibold text-[var(--text-secondary)] text-center">
                                {t('emptyOrder')}
                            </p>
                        </div>
                    )}
                    {orderId && items.map(item => {
                        return (
                            <div
                                key={item.id}
                                className="rounded-none border bg-[var(--bg-elevated)] border-[var(--border-strong)] transition-colors overflow-hidden"
                            >
                                <div className="flex gap-2.5 p-2.5 items-start">
                                    {/* Thumbnail */}
                                    <div className="w-24 h-24 shrink-0 rounded-xl overflow-hidden bg-[var(--bg-dark)] border border-[var(--border)]">
                                        {getImageSrc(item.image_path) ? (
                                            <img src={getImageSrc(item.image_path)!} alt={item.product_name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-[var(--text-secondary)] opacity-30 text-lg font-black">
                                                {(item.product_name ?? '?').charAt(0)}
                                            </div>
                                        )}
                                    </div>
                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start gap-1 mb-0.5">
                                            <div className="min-w-0">
                                                <p className={`text-sm font-bold text-[var(--foreground)] truncate leading-tight ${lang === 'km' ? 'khmer' : ''}`}>
                                                    {lang === 'km' ? (item.product_khmer || item.product_name) : item.product_name}
                                                </p>
                                                {item.variant_name && (
                                                    <p className="text-[11px] font-semibold text-[var(--accent-blue)] truncate leading-tight">{item.variant_name}</p>
                                                )}
                                                {item.modifiers && item.modifiers.length > 0 && (
                                                    <p className="text-[10px] font-medium text-[var(--text-secondary)] truncate leading-tight">
                                                        {item.modifiers.map(m => m.name).filter(Boolean).join(', ')}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <span className="text-sm font-bold font-mono text-[var(--accent-green)]">
                                                    {formatUsd(item.price_at_order * item.quantity)}
                                                </span>
                                                {removingItemId === item.id ? (
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => {
                                                                if (removeTimerRef.current) clearTimeout(removeTimerRef.current);
                                                                setRemovingItemId(null);
                                                                void handleCommittedQtySet(item.id, '0', item.quantity);
                                                            }}
                                                            className="px-1.5 py-0.5 rounded text-[10px] font-black bg-red-500 text-white hover:bg-red-600 transition-colors"
                                                        >
                                                            ✓
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (removeTimerRef.current) clearTimeout(removeTimerRef.current);
                                                                setRemovingItemId(null);
                                                            }}
                                                            className="px-1.5 py-0.5 rounded text-[10px] font-black bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => {
                                                            setRemovingItemId(item.id);
                                                            if (removeTimerRef.current) clearTimeout(removeTimerRef.current);
                                                            removeTimerRef.current = setTimeout(() => setRemovingItemId(null), 2000);
                                                        }}
                                                        className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-secondary)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                                        title={t('removeItem')}
                                                    >
                                                        <X size={13} strokeWidth={2.5} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {item.note && (
                                            <p className="text-[10px] text-[var(--accent-blue)] italic truncate mb-0.5">
                                                {item.note}
                                            </p>
                                        )}
                                        <p className="text-xs font-mono text-[var(--text-secondary)] mb-2">
                                            {formatUsd(item.price_at_order)}
                                        </p>
                                        <div className="flex items-center gap-1 p-0 rounded-lg bg-[var(--bg-dark)] border border-[var(--border)] min-h-10">
                                            <button
                                                onClick={() => handleQtyChange(item.id, item.quantity, -1)}
                                                className="w-10 h-10 flex items-center justify-center rounded-lg transition-colors hover:bg-red-500/20 text-[var(--text-secondary)] hover:text-red-400"
                                            >
                                                {item.quantity <= 1 ? <Trash2 size={16} /> : <Minus size={16} />}
                                            </button>
                                            <input
                                                type="number"
                                                min="0"
                                                inputMode="numeric"
                                                value={quantityDrafts[item.id] ?? String(item.quantity)}
                                                onChange={(e) => setQuantityDrafts(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                onBlur={(e) => handleCommittedQtySet(item.id, e.target.value, item.quantity)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.currentTarget.blur();
                                                    }
                                                    if (e.key === 'Escape') {
                                                        setQuantityDrafts(prev => ({ ...prev, [item.id]: String(item.quantity) }));
                                                        e.currentTarget.blur();
                                                    }
                                                }}
                                                className="font-bold font-mono text-lg flex-1 min-w-0 text-center text-[var(--foreground)] bg-transparent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                            />
                                            <button
                                                onClick={() => handleQtyChange(item.id, item.quantity, 1)}
                                                className="w-10 h-10 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--accent-green)]/20 text-[var(--accent-green)]"
                                            >
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                        {editingNoteId === item.id ? (
                                            <div className="mt-1.5 flex items-center gap-1">
                                                <StickyNote size={10} className="text-[var(--accent-blue)] flex-shrink-0" />
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    value={noteInput}
                                                    onChange={e => setNoteInput(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') handleNoteSave(item.id);
                                                        if (e.key === 'Escape') setEditingNoteId(null);
                                                    }}
                                                    onBlur={() => handleNoteSave(item.id)}
                                                    placeholder={t('addNote') + '...'}
                                                    className="flex-1 text-[10px] bg-[var(--bg-dark)] border border-[var(--accent-blue)]/40 rounded-md px-1.5 py-0.5 text-[var(--foreground)] placeholder:text-[var(--text-secondary)] outline-none focus:border-[var(--accent-blue)]/70"
                                                />
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => { setEditingNoteId(item.id); setNoteInput(item.note ?? ''); }}
                                                className="mt-1 flex items-center gap-1 text-[10px] text-[var(--text-secondary)] hover:text-[var(--accent-blue)] transition-colors"
                                            >
                                                <Pencil size={9} />
                                                {item.note
                                                    ? <span className="italic text-[var(--accent-blue)] truncate max-w-[120px]">{item.note}</span>
                                                    : <span>{t('addNote')}</span>
                                                }
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 px-3 py-3 bg-[var(--bg-elevated)] border-t border-[var(--border)] space-y-2.5">
                    {/* Order note */}
                    <div className="flex items-center gap-1.5">
                        <StickyNote size={11} className="text-[var(--text-secondary)] flex-shrink-0 opacity-60" />
                        <input
                            type="text"
                            value={orderNote}
                            onChange={e => setOrderNote(e.target.value)}
                            placeholder={t('orderNote') + '...'}
                            className="flex-1 text-[10px] bg-[var(--bg-dark)] border border-[var(--border)] rounded-md px-2 py-1 text-[var(--foreground)] placeholder:text-[var(--text-secondary)] outline-none focus:border-[var(--accent-blue)]/70 transition-colors"
                        />
                    </div>
                    <div className="space-y-1 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">
                        <div className="flex justify-between">
                            <span>{t('subtotal')}</span>
                            <span className="font-mono text-sm text-[var(--foreground)]">
                                {orderId ? formatUsd(totals.subtotalCents) : formatUsd(localCartTotalCents)}
                            </span>
                        </div>
                        {orderId && totals.vatCents > 0 && (
                            <div className="flex justify-between">
                                <span>{t('vat')}</span>
                                <span className="font-mono text-sm text-[var(--foreground)]">{formatUsd(totals.vatCents)}</span>
                            </div>
                        )}
                    </div>

                    <div>
                        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-1">{t('total')}</p>
                        <p className="text-3xl font-black font-mono text-[var(--foreground)] leading-none">
                            {orderId ? formatUsd(totals.totalUsdCents) : formatUsd(localCartTotalCents)}
                        </p>
                        {displayKhr > 0 && !rateIsDefault && (
                            <p className="text-sm font-mono text-[var(--text-secondary)] mt-0.5">
                                ≈ {formatKhr(displayKhr)}
                            </p>
                        )}
                    </div>

                    {/* LOCAL CART mode: Place Order (table) or Checkout (takeout) */}
                    {!orderId && (
                        <>
                        {localCart.length > 0 && (
                            <div>
                                {showClearConfirm ? (
                                    <div className="flex gap-1.5">
                                        <span className="flex-1 text-[10px] font-bold text-[var(--text-secondary)] flex items-center px-2">{t('clearOrderConfirm')}</span>
                                        <button
                                            onClick={() => setShowClearConfirm(false)}
                                            className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-all"
                                        >
                                            {t('no') ?? 'No'}
                                        </button>
                                        <button
                                            onClick={() => { setShowClearConfirm(false); clearOrder(); }}
                                            className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 transition-all"
                                        >
                                            {t('yes') ?? 'Yes'}
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setShowClearConfirm(true)}
                                        className="w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:border-red-500/40 hover:text-red-400 transition-all"
                                    >
                                        + {t('newCustomer')}
                                    </button>
                                )}
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-1.5">
                            <button
                                onClick={clearOrder}
                                className="py-4 rounded-2xl text-sm font-bold uppercase tracking-widest flex items-center justify-center gap-2 bg-red-500/8 border border-red-500/20 text-red-400/80 hover:text-red-400 hover:border-red-500/40 transition-all active:scale-95"
                            >
                                <XCircle size={16} strokeWidth={2.5} />
                                {t('cancel')}
                            </button>

                            {isTakeout ? (
                                <button
                                    onClick={onCheckout}
                                    disabled={localCart.length === 0 || committing}
                                    className="py-4 rounded-2xl text-sm font-bold uppercase tracking-widest flex items-center justify-center gap-2 bg-[var(--accent-green)]/15 border border-[var(--accent-green)]/30 text-[var(--accent-green)] hover:bg-[var(--accent-green)]/25 transition-all disabled:opacity-40 active:scale-95"
                                >
                                    {committing
                                        ? <Loader2 size={16} className="animate-spin" />
                                        : <CreditCard size={16} strokeWidth={2.5} />
                                    }
                                    {t('checkout')}
                                </button>
                            ) : (
                                <button
                                    onClick={handlePlaceOrder}
                                    disabled={localCart.length === 0 || committing}
                                    className="py-4 rounded-2xl text-sm font-bold uppercase tracking-widest flex items-center justify-center gap-2 bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent)] hover:bg-[var(--accent)]/25 transition-all disabled:opacity-40 active:scale-95"
                                >
                                    {committing
                                        ? <Loader2 size={16} className="animate-spin" />
                                        : <Check size={16} strokeWidth={2.5} />
                                    }
                                    {t('placeOrder')}
                                </button>
                            )}
                        </div>
                        </>
                    )}

                    {/* ORDER mode: Void + Hold + Checkout */}
                    {orderId && (
                        <div className={`grid gap-1.5 ${canVoidOrder(user?.role) ? 'grid-cols-3' : 'grid-cols-2'}`}>
                            {canVoidOrder(user?.role) && (
                                <button
                                    onClick={handleVoid}
                                    className="py-4 rounded-2xl text-sm font-bold uppercase tracking-widest flex items-center justify-center gap-2 bg-red-600 border border-red-700 text-white hover:bg-red-700 transition-all active:scale-95"
                                >
                                    <XCircle size={16} strokeWidth={2.5} />
                                    {t('voidOrder')}
                                </button>
                            )}
                            <button
                                onClick={onHold}
                                disabled={isEmpty}
                                className="py-4 rounded-2xl text-sm font-bold uppercase tracking-widest flex items-center justify-center gap-2 bg-yellow-500/8 border border-yellow-500/25 text-yellow-400/80 hover:text-yellow-400 hover:border-yellow-500/45 transition-all disabled:opacity-40 active:scale-95"
                            >
                                <PauseCircle size={16} strokeWidth={2.5} />
                                {t('hold')}
                            </button>
                            <button
                                className="py-4 rounded-2xl text-sm font-bold uppercase tracking-widest flex items-center justify-center gap-2 bg-[var(--accent-green)]/15 border border-[var(--accent-green)]/30 text-[var(--accent-green)] hover:bg-[var(--accent-green)]/25 transition-all disabled:opacity-40 active:scale-95"
                                disabled={isEmpty}
                                onClick={onCheckout}
                            >
                                <CreditCard size={16} strokeWidth={2.5} />
                                {t('checkout')}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <TableOrderHistoryModal
                isOpen={isHistoryOpen}
                tableId={tableId}
                sessionId={sessionId}
                onClose={() => setIsHistoryOpen(false)}
            />

            {/* Void confirmation dialog */}
            {showVoidConfirm && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60">
                    <div className="pos-card p-6 max-w-sm mx-4 space-y-4">
                        <h3 className="text-sm font-black text-red-400 uppercase tracking-widest">{t('voidOrder')}</h3>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                            {t('voidConfirmMessage')}
                        </p>
                        <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">{t('voidReasonLabel')}</p>
                            {VOID_REASONS.map(r => (
                                <button
                                    key={r.value}
                                    onClick={() => setVoidReason(r.value)}
                                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                                        voidReason === r.value
                                            ? 'bg-red-600/20 border-red-500 text-red-300'
                                            : 'border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)]'
                                    }`}
                                >
                                    {t(r.key)}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowVoidConfirm(false)}
                                className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-all"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={confirmVoid}
                                disabled={!voidReason}
                                className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest bg-red-600 text-white hover:bg-red-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {t('voidOrder')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Held Orders Drawer */}
            {showHeldDrawer && (
                <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowHeldDrawer(false)}>
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-sm max-h-[70vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                            <div className="flex items-center gap-2">
                                <PauseCircle size={15} className="text-amber-400" />
                                <h3 className="text-xs font-black uppercase tracking-widest text-[var(--foreground)]">{t('heldOrders')}</h3>
                                {heldOrders.length > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[9px] font-black">{heldOrders.length}</span>
                                )}
                            </div>
                            <button onClick={() => setShowHeldDrawer(false)} className="w-6 h-6 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--foreground)]">
                                <X size={13} />
                            </button>
                        </div>
                        <div className="overflow-y-auto flex-1 p-3 space-y-2">
                            {heldOrders.length === 0 ? (
                                <p className="text-center text-xs text-[var(--text-secondary)] py-8 opacity-50">{t('noHeldOrders')}</p>
                            ) : heldOrders.map(held => {
                                const heldDate = new Date(held.held_at + 'Z');
                                const minsAgo = Math.round((Date.now() - heldDate.getTime()) / 60000);
                                return (
                                    <div key={held.id} className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] hover:border-amber-500/40 transition-colors">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-black text-[var(--foreground)] truncate">
                                                {held.customer_name || held.table_id || (held.takeout_counter != null ? `#${held.takeout_counter}` : held.id.slice(0, 6).toUpperCase())}
                                            </p>
                                            <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                                                {held.item_count} {t('items')} · {formatUsd(held.total_usd)} · {minsAgo}m {t('ago')}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleResumeOrder(held)}
                                            disabled={resumingId === held.id}
                                            className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500 hover:text-black transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                                        >
                                            {resumingId === held.id ? <Loader2 size={12} className="animate-spin" /> : t('resumeOrder')}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={pendingResume !== null}
                title={t('resumeOrder')}
                message={t('resumeOrderConfirm')}
                confirmLabel={t('resumeOrder')}
                cancelLabel={t('cancel')}
                onConfirm={() => { if (pendingResume) doResumeOrder(pendingResume); }}
                onCancel={() => setPendingResume(null)}
            />
            {toast && <Toast message={toast.msg} variant={toast.ok ? 'success' : 'error'} onClose={() => setToast(null)} />}
        </>
    );
}