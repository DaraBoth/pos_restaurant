'use client';
import { useOrder } from '@/providers/OrderProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { useAuth } from '@/providers/AuthProvider';
import { updateOrderItemQuantity, updateOrderItemNote, voidOrder, getOrderItems, addRound, getSessionRounds } from '@/lib/tauri-commands';
import { formatUsd, formatKhr } from '@/lib/currency';
import { useState } from 'react';
import { Trash2, ShoppingCart, Plus, Minus, History, CreditCard, XCircle, Pencil, StickyNote, PauseCircle, ClipboardList, Loader2 } from 'lucide-react';
import TableOrderHistoryModal from '@/components/pos/TableOrderHistoryModal';

export default function SidebarCart({ onCheckout, onHold }: { onCheckout: () => void; onHold: () => void }) {
    const { items, totals, orderId, tableId, clearOrder, setItems, rounds, switchRound, sessionId, setRounds,
            localCart, addToLocalCart, updateLocalCartQty, commitLocalCart } = useOrder();
    const { t, lang } = useLanguage();
    const { user } = useAuth();
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [noteInput, setNoteInput] = useState('');
    const [committing, setCommitting] = useState(false);

    async function handleNoteSave(id: string) {
        try {
            await updateOrderItemNote(id, noteInput.trim() || undefined);
            if (orderId) {
                const updated = await getOrderItems(orderId);
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
            await updateOrderItemQuantity(id, nextQty);
            const updated = await getOrderItems(orderId);
            setItems(updated);
        } catch (e) {
            console.error(e);
        }
    }

    async function handleVoid() {
        if (!orderId) return;
        try {
            await voidOrder(orderId);
            clearOrder();
        } catch (e) {
            console.error(e);
        }
    }

    async function handleAddRound() {
        if (!user || !sessionId) return;
        try {
            const newOrderId = await addRound(user.id, sessionId);
            const newRounds = await getSessionRounds(sessionId);
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

    async function handlePlaceOrder() {
        if (!user || localCart.length === 0) return;
        setCommitting(true);
        try {
            await commitLocalCart(user.id);
        } catch (e) {
            console.error('Failed to place order', e);
        } finally {
            setCommitting(false);
        }
    }

    return (
        <>
            <div
                className="flex-shrink-0 flex flex-col min-h-0 bg-[var(--bg-card)]"
                style={{ width: 'var(--sidebar-cart-width)', borderLeft: '1px solid var(--border)' }}
            >
                {/* Header */}
                <div className="flex-shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-[var(--border)] bg-[var(--bg-elevated)]">
                    <div className="flex items-center gap-2">
                        <ShoppingCart size={14} className="text-[var(--accent)]" />
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
                    </div>
                </div>

                {/* Rounds Scroller (only for table sessions) */}
                {tableId && sessionId && rounds.length > 0 && (
                    <div className="flex-shrink-0 px-2 py-1.5 bg-[var(--bg-elevated)] border-b border-[var(--border)] overflow-x-auto no-scrollbar flex items-center gap-1.5 snap-x">
                        {rounds.map(round => {
                            const isActive = round.id === orderId;
                            return (
                                <button
                                    key={round.id}
                                    onClick={() => switchRound(round.id)}
                                    className={`snap-start flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wide transition-all ${
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
                            className="snap-start flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wide text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors flex items-center gap-1"
                        >
                            <Plus size={11} strokeWidth={3} />
                            New Round
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
                        <div key={item.productId} className="p-2 rounded-xl border bg-[var(--bg-elevated)] border-[var(--border)]">
                            <div className="flex justify-between items-start gap-2 mb-1.5">
                                <div className="flex-1 min-w-0">
                                    <p className={`text-xs font-semibold text-[var(--foreground)] truncate mb-0.5 ${lang === 'km' ? 'khmer' : ''}`}>
                                        {lang === 'km' ? (item.khmerName || item.productName) : item.productName}
                                    </p>
                                    <p className="text-[10px] font-mono text-[var(--text-secondary)]">
                                        {formatUsd(item.priceCents)}
                                    </p>
                                </div>
                                <span className="text-xs font-bold font-mono flex-shrink-0 text-[var(--accent-green)]">
                                    {formatUsd(item.priceCents * item.qty)}
                                </span>
                            </div>
                            <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--bg-dark)] border border-[var(--border)]">
                                <button
                                    onClick={() => updateLocalCartQty(item.productId, item.qty - 1)}
                                    className="w-6 h-6 flex items-center justify-center rounded-md transition-colors hover:bg-red-500/20 text-[var(--text-secondary)] hover:text-red-400"
                                >
                                    {item.qty <= 1 ? <Trash2 size={11} /> : <Minus size={11} />}
                                </button>
                                <span className="font-bold font-mono text-xs flex-1 text-center text-[var(--foreground)]">
                                    {item.qty}
                                </span>
                                <button
                                    onClick={() => updateLocalCartQty(item.productId, item.qty + 1)}
                                    className="w-6 h-6 flex items-center justify-center rounded-md transition-colors hover:bg-[var(--accent-green)]/20 text-[var(--accent-green)]"
                                >
                                    <Plus size={11} />
                                </button>
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
                                    className="p-2 rounded-xl border bg-[var(--bg-elevated)] border-[var(--border)] transition-colors"
                                >
                                    <div className="flex justify-between items-start gap-2 mb-1.5">
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-xs font-semibold text-[var(--foreground)] truncate mb-0.5 ${lang === 'km' ? 'khmer' : ''}`}>
                                                {lang === 'km' ? (item.product_khmer || item.product_name) : item.product_name}
                                            </p>
                                            {item.note && (
                                                <p className="text-[10px] text-[var(--accent-blue)] italic truncate">
                                                    {item.note}
                                                </p>
                                            )}
                                            <p className="text-[10px] font-mono text-[var(--text-secondary)]">
                                                {formatUsd(item.price_at_order)}
                                            </p>
                                        </div>
                                        <span className="text-xs font-bold font-mono flex-shrink-0 text-[var(--accent-green)]">
                                            {formatUsd(item.price_at_order * item.quantity)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--bg-dark)] border border-[var(--border)]">
                                        <button
                                            onClick={() => handleQtyChange(item.id, item.quantity, -1)}
                                            className="w-6 h-6 flex items-center justify-center rounded-md transition-colors hover:bg-red-500/20 text-[var(--text-secondary)] hover:text-red-400"
                                        >
                                            {item.quantity <= 1 ? <Trash2 size={11} /> : <Minus size={11} />}
                                        </button>
                                        <span className="font-bold font-mono text-xs flex-1 text-center text-[var(--foreground)]">
                                            {item.quantity}
                                        </span>
                                        <button
                                            onClick={() => handleQtyChange(item.id, item.quantity, 1)}
                                            className="w-6 h-6 flex items-center justify-center rounded-md transition-colors hover:bg-[var(--accent-green)]/20 text-[var(--accent-green)]"
                                        >
                                            <Plus size={11} />
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
                            );
                        })}
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 px-3 py-3 bg-[var(--bg-elevated)] border-t border-[var(--border)] space-y-2.5">
                    <div className="space-y-0.5 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-widest">
                        <div className="flex justify-between">
                            <span>{t('subtotal')}</span>
                            <span className="font-mono text-[var(--foreground)]">
                                {orderId ? formatUsd(totals.subtotalCents) : formatUsd(localCartTotalCents)}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-end justify-between">
                        <div>
                            <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-0.5">{t('total')}</p>
                            <p className="text-lg font-black font-mono text-[var(--foreground)] leading-none">
                                {orderId ? formatUsd(totals.totalUsdCents) : formatUsd(localCartTotalCents)}
                            </p>
                        </div>
                        <p className="text-xs font-mono text-[var(--text-secondary)] opacity-50">
                            {orderId ? formatKhr(totals.totalKhr) : ''}
                        </p>
                    </div>

                    {/* LOCAL CART mode: Place Order (table) or Checkout (takeout) */}
                    {!orderId && (
                        <div className="grid grid-cols-2 gap-1.5">
                            <button
                                onClick={clearOrder}
                                className="py-2 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 bg-red-500/8 border border-red-500/20 text-red-400/80 hover:text-red-400 hover:border-red-500/40 transition-all active:scale-95"
                            >
                                <XCircle size={12} strokeWidth={2.5} />
                                {t('cancel')}
                            </button>
                            <button
                                onClick={onCheckout}
                                disabled={localCart.length === 0 || committing}
                                className="py-2 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 bg-[var(--accent-green)]/15 border border-[var(--accent-green)]/30 text-[var(--accent-green)] hover:bg-[var(--accent-green)]/25 transition-all disabled:opacity-40 active:scale-95"
                            >
                                {committing
                                    ? <Loader2 size={12} className="animate-spin" />
                                    : <CreditCard size={12} strokeWidth={2.5} />
                                }
                                {t('checkout')}
                            </button>
                        </div>
                    )}

                    {/* ORDER mode: Void + Hold + Checkout */}
                    {orderId && (
                        <div className="grid grid-cols-3 gap-1.5">
                            <button
                                onClick={handleVoid}
                                className="py-2 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 bg-red-500/8 border border-red-500/20 text-red-400/80 hover:text-red-400 hover:border-red-500/40 transition-all active:scale-95"
                            >
                                <XCircle size={12} strokeWidth={2.5} />
                                {t('cancel')}
                            </button>
                            <button
                                onClick={onHold}
                                disabled={isEmpty}
                                className="py-2 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 bg-yellow-500/8 border border-yellow-500/25 text-yellow-400/80 hover:text-yellow-400 hover:border-yellow-500/45 transition-all disabled:opacity-40 active:scale-95"
                            >
                                <PauseCircle size={12} strokeWidth={2.5} />
                                Hold
                            </button>
                            <button
                                className="py-2 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 bg-[var(--accent-green)]/15 border border-[var(--accent-green)]/30 text-[var(--accent-green)] hover:bg-[var(--accent-green)]/25 transition-all disabled:opacity-40 active:scale-95"
                                disabled={isEmpty}
                                onClick={onCheckout}
                            >
                                <CreditCard size={12} strokeWidth={2.5} />
                                {t('checkout')}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <TableOrderHistoryModal
                isOpen={isHistoryOpen}
                tableId={tableId}
                onClose={() => setIsHistoryOpen(false)}
            />
        </>
    );
}