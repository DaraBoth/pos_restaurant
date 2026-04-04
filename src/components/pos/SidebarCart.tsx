'use client';
import { useOrder } from '@/providers/OrderProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { useAuth } from '@/providers/AuthProvider';
import { updateOrderItemQuantity, updateOrderItemNote, voidOrder, getOrderItems, addRound, getSessionRounds, getRestaurant, getSessionOrderItems } from '@/lib/tauri-commands';
import { formatUsd, formatKhr, calculateTotals } from '@/lib/currency';
import { useEffect, useState, useRef } from 'react';
import { Trash2, ShoppingCart, Plus, Minus, History, CreditCard, XCircle, Pencil, StickyNote, PauseCircle, ClipboardList, Loader2, Check, ChevronLeft, ChevronRight, Printer, X } from 'lucide-react';
import TableOrderHistoryModal from '@/components/pos/TableOrderHistoryModal';
import { printReceipt, ReceiptPrintPayload } from '@/lib/receipt';
import { getImageSrc } from '@/lib/image';

export default function SidebarCart({ onCheckout, onHold, isTakeout }: { onCheckout: () => void; onHold: () => void; isTakeout?: boolean }) {
    const { items, totals, orderId, tableId, clearOrder, setItems, rounds, switchRound, sessionId, setRounds,
            localCart, addToLocalCart, updateLocalCartQty, commitLocalCart, exchangeRate } = useOrder();
    const { t, lang } = useLanguage();
    const { user } = useAuth();
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [noteInput, setNoteInput] = useState('');
    const [committing, setCommitting] = useState(false);
    const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
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
                next[`local-${item.productId}`] = String(item.qty);
            }

            for (const item of items) {
                next[item.id] = String(item.quantity);
            }

            return next;
        });
    }, [items, localCart]);



    async function handleNoteSave(id: string) {
        try {
            await updateOrderItemNote(id, noteInput.trim() || undefined, user?.restaurant_id || '');
            if (orderId) {
                const updated = await getOrderItems(orderId, user?.restaurant_id || '');
                setItems(updated);
            }
        } catch (e) {
            console.error(e);
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

    function handleLocalQtySet(productId: string, rawValue: string, fallbackQty: number) {
        const trimmed = rawValue.trim();
        const parsed = Number.parseInt(trimmed, 10);

        if (!trimmed || Number.isNaN(parsed)) {
            setQuantityDrafts(prev => ({ ...prev, [`local-${productId}`]: String(fallbackQty) }));
            return;
        }

        updateLocalCartQty(productId, Math.max(0, parsed));
    }

    async function handleVoid() {
        if (!orderId) return;
        try {
            await voidOrder(orderId, user?.restaurant_id || '');
            clearOrder();
        } catch (e) {
            console.error(e);
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
        }
    }

    const isEmpty = items.length === 0;
    const totalQty = items.reduce((s, i) => s + i.quantity, 0);
    const localCartTotalCents = localCart.reduce((s, i) => s + i.priceCents * i.qty, 0);
    const localCartTotalQty = localCart.reduce((s, i) => s + i.qty, 0);

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
                const groupedMap = new Map<string, any>();
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
                receiptTotals = calculateTotals(subtotal, exchangeRate);
            } else if (!orderId && localCart.length > 0) {
                // Map local cart to OrderItem for preview
                receiptItems = localCart.map(i => ({
                    id: `local-${i.productId}`,
                    order_id: 'PREVIEW',
                    product_id: i.productId,
                    product_name: i.productName,
                    product_khmer: i.khmerName,
                    quantity: i.qty,
                    price_at_order: i.priceCents,
                    total_at_order: i.priceCents * i.qty,
                    status: 'pending',
                    created_at: new Date().toISOString()
                })) as any; // Cast because status/created_at don't exist on OrderItem type but engine handles them or ignores

                receiptTotals = {
                    subtotalCents: localCartTotalCents,
                    vatCents: 0,
                    pltCents: 0,
                    totalUsdCents: localCartTotalCents,
                    totalKhr: localCartTotalCents * 4100 // Approximation or get from provider if available
                };
            }

            if (receiptItems.length === 0) return;

            const payload: ReceiptPrintPayload = {
                restaurant,
                orderId: orderId || 'PREVIEW',
                tableId: tableId || undefined,
                items: receiptItems,
                payments: [], // Preview has no payments yet
                totals: receiptTotals
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
            alert('Failed to place order: ' + String(e));
        } finally {
            setCommitting(false);
        }
    }

    return (
        <>
            <div
                className="flex-shrink-0 flex flex-col min-h-0 bg-[var(--bg-card)] border-l border-y border-[var(--border)] rounded-l-2xl overflow-hidden"
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
                            onClick={handlePrintReceipt}
                            disabled={orderId ? isEmpty : localCart.length === 0}
                            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--accent)]/20 text-[var(--accent)] disabled:opacity-30"
                            title="Print Receipt Preview"
                        >
                            <Printer size={13} />
                        </button>
                    </div>
                </div>

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
                                        className={`snap-start flex-shrink-0 px-4 py-3 rounded-xl text-sm font-bold tracking-wide transition-all ${
                                            isActive
                                                ? 'bg-[var(--accent-blue)] text-white shadow-sm'
                                                : 'bg-[var(--bg-dark)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:border-[var(--accent-blue)]/50'
                                        }`}
                                    >
                                        Round {round.round_number}
                                        {isActive && <span className="ml-1.5 opacity-80">(View)</span>}
                                    </button>
                                );
                            })}
                            <button
                                onClick={handleAddRound}
                                className="snap-start flex-shrink-0 px-4 py-3 rounded-xl text-sm font-bold tracking-wide text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors flex items-center gap-2"
                            >
                                <Plus size={14} strokeWidth={3} />
                                New Round
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
                <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5 min-h-0 no-scrollbar bg-[var(--bg-dark)]">
                    {/* ── LOCAL CART (before order is placed) ── */}
                    {!orderId && localCart.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center gap-2 opacity-30">
                            <ShoppingCart size={28} className="text-[var(--text-secondary)]" />
                            <p className="text-xs font-semibold text-[var(--text-secondary)] text-center">
                                {t('emptyOrder')}
                            </p>
                        </div>
                    )}
                    {!orderId && localCart.map(item => (
                        <div key={item.productId} className="rounded-none border bg-[var(--bg-elevated)] border-[var(--border-strong)] overflow-hidden">
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
                                        <p className={`text-sm font-bold text-[var(--foreground)] truncate leading-tight ${item.khmerName ? 'khmer' : ''}`}>
                                            {item.productName}
                                        </p>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <span className="text-sm font-bold font-mono text-[var(--accent-green)]">
                                                {formatUsd(item.priceCents * item.qty)}
                                            </span>
                                            <button
                                                onClick={() => updateLocalCartQty(item.productId, 0)}
                                                className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-secondary)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                                title="Remove item"
                                            >
                                                <X size={13} strokeWidth={2.5} />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-xs font-mono text-[var(--text-secondary)] mb-2">
                                        {formatUsd(item.priceCents)}
                                    </p>
                                    <div className="flex items-center gap-1 p-0.5 rounded-xl bg-[var(--bg-dark)] border border-[var(--border)] min-h-14">
                                        <button
                                            onClick={() => updateLocalCartQty(item.productId, item.qty - 1)}
                                            className="w-10 h-10 flex items-center justify-center rounded-lg transition-colors hover:bg-red-500/20 text-[var(--text-secondary)] hover:text-red-400"
                                        >
                                            {item.qty <= 1 ? <Trash2 size={16} /> : <Minus size={16} />}
                                        </button>
                                        <input
                                            type="number"
                                            min="0"
                                            inputMode="numeric"
                                            value={quantityDrafts[`local-${item.productId}`] ?? String(item.qty)}
                                            onChange={(e) => setQuantityDrafts(prev => ({ ...prev, [`local-${item.productId}`]: e.target.value }))}
                                            onBlur={(e) => handleLocalQtySet(item.productId, e.target.value, item.qty)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.currentTarget.blur();
                                                }
                                                if (e.key === 'Escape') {
                                                    setQuantityDrafts(prev => ({ ...prev, [`local-${item.productId}`]: String(item.qty) }));
                                                    e.currentTarget.blur();
                                                }
                                            }}
                                            className="font-bold font-mono text-lg flex-1 min-w-0 text-center text-[var(--foreground)] bg-transparent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                        />
                                        <button
                                            onClick={() => updateLocalCartQty(item.productId, item.qty + 1)}
                                            className="w-10 h-10 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--accent-green)]/20 text-[var(--accent-green)]"
                                        >
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
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
                                                <p className={`text-sm font-bold text-[var(--foreground)] truncate leading-tight ${lang === 'km' ? 'khmer' : ''}`}>
                                                    {lang === 'km' ? (item.product_khmer || item.product_name) : item.product_name}
                                                </p>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <span className="text-sm font-bold font-mono text-[var(--accent-green)]">
                                                        {formatUsd(item.price_at_order * item.quantity)}
                                                    </span>
                                                    <button
                                                        onClick={() => void handleCommittedQtySet(item.id, '0', item.quantity)}
                                                        className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-secondary)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                                        title="Remove item"
                                                    >
                                                        <X size={13} strokeWidth={2.5} />
                                                    </button>
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
                                            <div className="flex items-center gap-1 p-0.5 rounded-xl bg-[var(--bg-dark)] border border-[var(--border)] min-h-14">
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
                    <div className="space-y-1 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">
                        <div className="flex justify-between">
                            <span>{t('subtotal')}</span>
                            <span className="font-mono text-sm text-[var(--foreground)]">
                                {orderId ? formatUsd(totals.subtotalCents) : formatUsd(localCartTotalCents)}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-end justify-between">
                        <div>
                            <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-1">{t('total')}</p>
                            <p className="text-3xl font-black font-mono text-[var(--foreground)] leading-none">
                                {orderId ? formatUsd(totals.totalUsdCents) : formatUsd(localCartTotalCents)}
                            </p>
                        </div>
                        <p className="text-sm font-mono text-[var(--text-secondary)] opacity-50">
                            {orderId ? formatKhr(totals.totalKhr) : ''}
                        </p>
                    </div>

                    {/* LOCAL CART mode: Place Order (table) or Checkout (takeout) */}
                    {!orderId && (
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
                                    Place Order
                                </button>
                            )}
                        </div>
                    )}

                    {/* ORDER mode: Void + Hold + Checkout */}
                    {orderId && (
                        <div className="grid grid-cols-3 gap-1.5">
                            <button
                                onClick={handleVoid}
                                className="py-4 rounded-2xl text-sm font-bold uppercase tracking-widest flex items-center justify-center gap-2 bg-red-500/8 border border-red-500/20 text-red-400/80 hover:text-red-400 hover:border-red-500/40 transition-all active:scale-95"
                            >
                                <XCircle size={16} strokeWidth={2.5} />
                                {t('cancel')}
                            </button>
                            <button
                                onClick={onHold}
                                disabled={isEmpty}
                                className="py-4 rounded-2xl text-sm font-bold uppercase tracking-widest flex items-center justify-center gap-2 bg-yellow-500/8 border border-yellow-500/25 text-yellow-400/80 hover:text-yellow-400 hover:border-yellow-500/45 transition-all disabled:opacity-40 active:scale-95"
                            >
                                <PauseCircle size={16} strokeWidth={2.5} />
                                Hold
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
        </>
    );
}