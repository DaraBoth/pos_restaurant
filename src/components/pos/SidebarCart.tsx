'use client';
import { useOrder } from '@/providers/OrderProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { updateOrderItemQuantity, updateOrderItemNote, voidOrder } from '@/lib/tauri-commands';
import { getOrderItems } from '@/lib/tauri-commands';
import { formatUsd, formatKhr } from '@/lib/currency';
import { useState } from 'react';
import { Trash2, ShoppingCart, Plus, Minus, History, UtensilsCrossed, CheckCircle2, CreditCard, PauseCircle, XCircle, Pencil, StickyNote } from 'lucide-react';
import TableOrderHistoryModal from '@/components/pos/TableOrderHistoryModal';

const KITCHEN_BADGE: Record<string, { label: string; labelKm: string; cls: string }> = {
    pending: { label: 'Pending', labelKm: '\u179a\u1784\u17d2\u1785\u17b6\u17c6',  cls: 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]' },
    cooking: { label: 'Cooking', labelKm: '\u1785\u17c6\u17a2\u17b7\u1793',   cls: 'bg-orange-500/15 text-orange-400 border border-orange-500/30' },
    done:    { label: 'Done',    labelKm: '\u179a\u17bd\u1785\u179a\u17b6\u179b\u17d0', cls: 'bg-green-500/15 text-green-400 border border-green-500/30' },
};

export default function SidebarCart({ onCheckout }: { onCheckout: () => void }) {
    const { items, totals, orderId, tableId, clearOrder, setItems } = useOrder();
    const { t, lang } = useLanguage();
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [orderSent, setOrderSent] = useState(false);
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [noteInput, setNoteInput] = useState('');

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
        const msg = lang === 'km' ? '\u179b\u17bb\u1794\u1794\u1789\u17d2\u1787\u17b6\u1791\u17b7\u1789\u178f\u17b6\u17c6\u1784\u17a2\u179f\u17d2?' : 'Cancel the entire order?';
        if (confirm(msg)) {
            try {
                await voidOrder(orderId);
                clearOrder();
            } catch (e) {
                console.error(e);
            }
        }
    }

    function handleSendToKitchen() {
        setOrderSent(true);
        setTimeout(() => setOrderSent(false), 2500);
    }

    const isEmpty = items.length === 0;
    const totalQty = items.reduce((s, i) => s + i.quantity, 0);
    const doneItemsCents = items
        .filter(i => i.kitchen_status === 'done')
        .reduce((s, i) => s + i.price_at_order * i.quantity, 0);

    return (
        <>
            <div
                className="flex-shrink-0 flex flex-col min-h-0 bg-[#101a24]"
                style={{ width: 'var(--sidebar-cart-width)', borderLeft: '1px solid var(--border)' }}
            >
                {/* Header */}
                <div className="flex-shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-[var(--border)] bg-[#162230]">
                    <div className="flex items-center gap-2">
                        <ShoppingCart size={14} className="text-[var(--accent)]" />
                        <span className="text-xs font-bold text-[var(--foreground)]">
                            {lang === 'km' ? '\u1794\u1789\u17d2\u1787\u17b8\u1791\u17b7\u1789' : 'Order'}
                        </span>
                        {totalQty > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[var(--accent)] text-white">
                                {totalQty}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        {tableId && (
                            <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-[#0d1721] border border-[var(--border)] text-[var(--accent-blue)]">
                                {tableId}
                            </span>
                        )}
                        {tableId && (
                            <button
                                onClick={() => setIsHistoryOpen(true)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--accent-blue)]/20 text-[var(--text-secondary)] hover:text-[var(--accent-blue)]"
                                title={lang === 'km' ? '\u1794\u17d2\u179a\u179c\u178f\u17d2\u178f\u17b7' : 'History'}
                            >
                                <History size={13} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5 min-h-0 no-scrollbar bg-[#0f1822]">
                    {isEmpty ? (
                        <div className="h-full flex flex-col items-center justify-center gap-2 opacity-30">
                            <ShoppingCart size={28} className="text-[var(--text-secondary)]" />
                            <p className="text-xs font-semibold text-[var(--text-secondary)] text-center">
                                {t('emptyOrder')}
                            </p>
                        </div>
                    ) : (
                        items.map(item => {
                            const badge = KITCHEN_BADGE[item.kitchen_status] ?? KITCHEN_BADGE.pending;
                            const isDone = item.kitchen_status === 'done';
                            const isCooking = item.kitchen_status === 'cooking';
                            return (
                                <div
                                    key={item.id}
                                    className={`p-2 rounded-xl border transition-colors ${
                                        isDone
                                            ? 'bg-green-500/5 border-green-500/20'
                                            : isCooking
                                            ? 'bg-orange-500/5 border-orange-500/20'
                                            : 'bg-[var(--bg-elevated)] border-[var(--border)]'
                                    }`}
                                >
                                    <div className="flex justify-between items-start gap-2 mb-1.5">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <p className={`text-xs font-semibold text-[var(--foreground)] truncate ${lang === 'km' ? 'khmer' : ''}`}>
                                                    {lang === 'km' ? (item.product_khmer || item.product_name) : item.product_name}
                                                </p>
                                                {(isDone || isCooking) && (
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 ${badge.cls}`}>
                                                        {lang === 'km' ? badge.labelKm : badge.label}
                                                    </span>
                                                )}
                                            </div>
                                            {/* note shown via edit button below for pending; shown static for cooking/done */}
                                            {(isDone || isCooking) && item.note && (
                                                <p className="text-[10px] text-[var(--accent-blue)] italic truncate">
                                                    {item.note}
                                                </p>
                                            )}
                                            <p className="text-[10px] font-mono text-[var(--text-secondary)]">
                                                {formatUsd(item.price_at_order)}
                                            </p>
                                        </div>
                                        <span className={`text-xs font-bold font-mono flex-shrink-0 ${isDone ? 'text-green-400' : 'text-[var(--accent-green)]'}`}>
                                            {formatUsd(item.price_at_order * item.quantity)}
                                        </span>
                                    </div>
                                    <div className={`flex items-center gap-0.5 p-0.5 rounded-lg bg-[#0d1721] border border-[var(--border)] ${isDone || isCooking ? 'opacity-40 pointer-events-none' : ''}`}>
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
                                    {/* Inline note editor — only for pending items */}
                                    {!isDone && !isCooking && (
                                        editingNoteId === item.id ? (
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
                                                    placeholder={lang === 'km' ? 'កំណត់ចំណាំ...' : 'Add note...'}
                                                    className="flex-1 text-[10px] bg-[#0d1721] border border-[var(--accent-blue)]/40 rounded-md px-1.5 py-0.5 text-[var(--foreground)] placeholder:text-[var(--text-secondary)] outline-none focus:border-[var(--accent-blue)]/70"
                                                />
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    setEditingNoteId(item.id);
                                                    setNoteInput(item.note ?? '');
                                                }}
                                                className="mt-1 flex items-center gap-1 text-[10px] text-[var(--text-secondary)] hover:text-[var(--accent-blue)] transition-colors"
                                            >
                                                <Pencil size={9} />
                                                {item.note
                                                    ? <span className="italic text-[var(--accent-blue)] truncate max-w-[120px]">{item.note}</span>
                                                    : <span>{lang === 'km' ? 'បន្ថែមចំណាំ' : 'Add note'}</span>
                                                }
                                            </button>
                                        )
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 px-3 py-3 bg-[#162230] border-t border-[var(--border)] space-y-2.5">
                    <div className="space-y-0.5 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-widest">
                        <div className="flex justify-between">
                            <span>{t('subtotal')}</span>
                            <span className="font-mono text-[var(--foreground)]">{formatUsd(totals.subtotalCents)}</span>
                        </div>
                        {doneItemsCents > 0 && doneItemsCents !== totals.subtotalCents && (
                            <div className="flex justify-between text-green-400">
                                <span className="flex items-center gap-1">
                                    <CheckCircle2 size={9} />
                                    {lang === 'km' ? '\u179a\u17bd\u1785\u179a\u17b6\u179b\u17d0' : 'Done items'}
                                </span>
                                <span className="font-mono">{formatUsd(doneItemsCents)}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-end justify-between">
                        <div>
                            <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-0.5">{t('total')}</p>
                            <p className="text-lg font-black font-mono text-[var(--foreground)] leading-none">
                                {formatUsd(totals.totalUsdCents)}
                            </p>
                        </div>
                        <p className="text-xs font-mono text-[var(--text-secondary)] opacity-50">
                            {formatKhr(totals.totalKhr)}
                        </p>
                    </div>

                    {/* Send to Kitchen */}
                    <button
                        onClick={handleSendToKitchen}
                        disabled={isEmpty || !orderId}
                        className={`w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 ${
                            orderSent
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : 'bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue)]/90 disabled:opacity-40'
                        }`}
                    >
                        {orderSent ? (
                            <><CheckCircle2 size={13} strokeWidth={2.5} />{lang === 'km' ? '\u1794\u17b6\u1793\u1795\u17d2\u1789\u17be\u178f\u17c0\u1795\u17d2\u178f\u17c0\u1794\u17b6\u1799!' : 'Sent to Kitchen!'}</>
                        ) : (
                            <><UtensilsCrossed size={13} strokeWidth={2.5} />{lang === 'km' ? '\u1795\u17d2\u1789\u17be\u178f\u17c0\u1795\u17d2\u178f\u17c0\u1794\u17b6\u1799' : 'Send to Kitchen'}</>
                        )}
                    </button>

                    {/* Hold + Cancel */}
                    <div className="grid grid-cols-2 gap-1.5">
                        <button
                            onClick={clearOrder}
                            disabled={!orderId}
                            className="py-2 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:border-[var(--accent-blue)]/40 transition-all disabled:opacity-40 active:scale-95"
                        >
                            <PauseCircle size={12} strokeWidth={2.5} />
                            {lang === 'km' ? '\u179a\u1780\u17d2\u179f\u17b6\u178f\u17bb\u1780' : 'Hold'}
                        </button>
                        <button
                            onClick={handleVoid}
                            disabled={!orderId}
                            className="py-2 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 bg-red-500/8 border border-red-500/20 text-red-400/80 hover:text-red-400 hover:border-red-500/40 transition-all disabled:opacity-40 active:scale-95"
                        >
                            <XCircle size={12} strokeWidth={2.5} />
                            {lang === 'km' ? '\u179b\u17bb\u1794' : 'Cancel'}
                        </button>
                    </div>

                    {/* Checkout */}
                    <button
                        className="w-full py-2 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 bg-[var(--accent-green)]/15 border border-[var(--accent-green)]/30 text-[var(--accent-green)] hover:bg-[var(--accent-green)]/25 transition-all disabled:opacity-40 active:scale-95"
                        disabled={isEmpty || !orderId}
                        onClick={onCheckout}
                    >
                        <CreditCard size={12} strokeWidth={2.5} />
                        {lang === 'km' ? '\u178f\u17bc\u178f\u17b6\u178f\u17d0' : 'Checkout'}
                    </button>
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