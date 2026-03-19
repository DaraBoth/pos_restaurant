'use client';
import { useOrder } from '@/providers/OrderProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { updateOrderItemQuantity, voidOrder } from '@/lib/tauri-commands';
import { getOrderItems } from '@/lib/tauri-commands';
import { formatUsd, formatKhr } from '@/lib/currency';
import { useState } from 'react';
import { Trash2, ShoppingCart, Plus, Minus, History } from 'lucide-react';
import TableOrderHistoryModal from '@/components/pos/TableOrderHistoryModal';

export default function SidebarCart({ onCheckout }: { onCheckout: () => void }) {
    const { items, totals, orderId, tableId, clearOrder, setItems } = useOrder();
    const { t, lang } = useLanguage();
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

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
        const msg = lang === 'km' ? 'áž›áž»áž”áž”áž‰áŸ’áž‡áž¶áž‘áž·áž‰áž‘áž¶áŸ†áž„áž¢ážŸáŸ‹?' : 'Void entire order?';
        if (confirm(msg)) {
            try {
                await voidOrder(orderId);
                clearOrder();
            } catch (e) {
                console.error(e);
            }
        }
    }

    const isEmpty = items.length === 0;
    const totalQty = items.reduce((s, i) => s + i.quantity, 0);

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
                            {lang === 'km' ? 'áž”áž‰áŸ’áž‡áž¸áž‘áž·áž‰' : 'Order'}
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
                                title={lang === 'km' ? 'áž”áŸ’ážšážœážáŸ’ážáž·' : 'History'}
                            >
                                <History size={13} />
                            </button>
                        )}
                        {orderId && (
                            <button
                                onClick={handleVoid}
                                className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-red-500/10 text-red-400"
                                title={t('voidOrder')}
                            >
                                <Trash2 size={13} />
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
                        items.map(item => (
                            <div
                                key={item.id}
                                className="p-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] hover:border-[var(--accent-blue)]/30 transition-colors"
                            >
                                <div className="flex justify-between items-start gap-2 mb-1.5">
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-xs font-semibold text-[var(--foreground)] truncate ${lang === 'km' ? 'khmer' : ''}`}>
                                            {lang === 'km' ? (item.product_khmer || item.product_name) : item.product_name}
                                        </p>
                                        <p className="text-[10px] font-mono text-[var(--text-secondary)]">
                                            {formatUsd(item.price_at_order)}
                                        </p>
                                    </div>
                                    <span className="text-xs font-bold font-mono text-[var(--accent-green)] flex-shrink-0">
                                        {formatUsd(item.price_at_order * item.quantity)}
                                    </span>
                                </div>
                                {/* Qty Controls */}
                                <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[#0d1721] border border-[var(--border)]">
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
                            </div>
                        ))
                    )}
                </div>

                {/* Checkout Footer */}
                <div className="flex-shrink-0 px-3 py-3 bg-[#162230] border-t border-[var(--border)]">
                    <div className="space-y-1 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-2">
                        <div className="flex justify-between">
                            <span>{t('subtotal')}</span>
                            <span className="font-mono text-[var(--foreground)]">{formatUsd(totals.subtotalCents)}</span>
                        </div>
                    </div>
                    <div className="flex items-end justify-between mb-3">
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
                    <button
                        className="pos-btn-primary w-full py-2.5 text-xs font-bold uppercase tracking-widest"
                        disabled={isEmpty || !orderId}
                        onClick={onCheckout}
                    >
                        {t('checkout')}
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
