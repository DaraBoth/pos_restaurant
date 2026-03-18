'use client';
import { useOrder } from '@/contexts/OrderContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { updateOrderItemQuantity, voidOrder } from '@/lib/tauri-commands';
import { getOrderItems } from '@/lib/tauri-commands';
import { formatUsd, formatKhr } from '@/lib/currency';
import { useState } from 'react';
import { Trash2, ShoppingCart, Plus, Minus, TableProperties, Ticket, History } from 'lucide-react';
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
        if (confirm('Void entire order?')) {
            try {
                await voidOrder(orderId);
                clearOrder();
            } catch (e) {
                console.error(e);
            }
        }
    }

    const isEmpty = items.length === 0;

    return (
        <>
            <div
                className="flex-shrink-0 flex flex-col min-h-0 bg-[var(--bg-card)] relative"
                style={{
                    width: 'var(--sidebar-cart-width)',
                    borderLeft: '1px solid var(--border)',
                    boxShadow: '-1px 0 20px rgba(0,0,0,0.02)',
                }}
            >
            {/* Header / Ticket Strip */}
            <div className="flex-shrink-0 flex items-center justify-between px-[var(--space-unit)] py-4 border-b border-[var(--border)] bg-[var(--bg-elevated)]">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--accent)]/10">
                        <Ticket size={16} className="text-[var(--accent)]" />
                    </div>
                    <span className="font-bold text-[var(--text-base)] text-[var(--foreground)]">Order</span>
                    {items.length > 0 && (
                        <span className="text-[var(--text-xs)] font-bold px-2 py-0.5 rounded-md bg-[var(--accent)] text-white">
                            {items.reduce((s, i) => s + i.quantity, 0)}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {tableId && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--background)] border border-[var(--border)] text-[var(--accent)]">
                            <TableProperties size={12} />
                            {tableId}
                        </div>
                    )}
                    {tableId && (
                        <button
                            onClick={() => setIsHistoryOpen(true)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-white/5 text-[var(--text-secondary)] hover:text-white"
                            title="Table order history"
                        >
                            <History size={15} />
                        </button>
                    )}
                    {orderId && (
                        <button
                            onClick={handleVoid}
                            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-red-500/10 text-red-400"
                            title={t('voidOrder')}
                        >
                            <Trash2 size={15} />
                        </button>
                    )}
                </div>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0 container-snap">
                {isEmpty ? (
                    <div className="h-full flex flex-col items-center justify-center gap-4 opacity-40">
                        <ShoppingCart size={40} className="text-[var(--text-secondary)]" />
                        <div className="text-center">
                            <p className="font-semibold text-sm text-[var(--text-secondary)]">{t('emptyOrder')}</p>
                        </div>
                    </div>
                ) : (
                    items.map(item => (
                        <div
                            key={item.id}
                            className="p-[var(--space-unit)] rounded-2xl animate-fade-in bg-[var(--bg-elevated)] border border-[var(--border)] hover:border-[var(--accent)]/30 transition-colors"
                        >
                            <div className="flex justify-between items-start gap-3 mb-4">
                                <div className="flex-1 min-w-0">
                                    <h3 className={`font-bold text-[var(--text-sm)] text-[var(--foreground)] truncate ${lang === 'km' ? 'khmer' : ''}`}>
                                        {lang === 'km' ? (item.product_khmer || item.product_name) : item.product_name}
                                    </h3>
                                    <p className="text-[var(--text-xs)] mt-0.5 font-mono text-[var(--text-secondary)]">
                                        {formatUsd(item.price_at_order)}
                                    </p>
                                </div>
                                <span className="font-mono font-black text-[var(--text-sm)] text-[var(--accent)]">
                                    {formatUsd(item.price_at_order * item.quantity)}
                                </span>
                            </div>

                            {/* Qty Controls */}
                            <div className="flex items-center justify-between gap-1 p-1 rounded-xl bg-[var(--background)] border border-[var(--border)]">
                                <button
                                    onClick={() => handleQtyChange(item.id, item.quantity, -1)}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-red-50 text-[var(--text-secondary)] hover:text-red-600"
                                >
                                    {item.quantity <= 1 ? <Trash2 size={13} /> : <Minus size={13} />}
                                </button>
                                <span className="font-black font-mono text-[var(--text-sm)] flex-1 text-center text-[var(--foreground)]">
                                    {item.quantity}
                                </span>
                                <button
                                    onClick={() => handleQtyChange(item.id, item.quantity, 1)}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--accent)]/10 text-[var(--accent)]"
                                >
                                    <Plus size={13} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Checkout Footer */}
            <div className="flex-shrink-0 p-5 bg-[var(--bg-elevated)] border-t border-[var(--border)]">
                <div className="space-y-2 text-[var(--text-xs)] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-6 opacity-60">
                    <div className="flex justify-between items-center">
                        <span>{t('subtotal')}</span>
                        <span className="font-mono text-[var(--foreground)]">{formatUsd(totals.subtotalCents)}</span>
                    </div>
                </div>

                <div className="flex items-end justify-between mb-6">
                    <div>
                        <p className="text-[var(--text-xs)] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-1 opacity-60">{t('total')}</p>
                        <p className="text-[var(--text-3xl)] font-black font-mono text-[var(--foreground)] leading-none">
                            {formatUsd(totals.totalUsdCents)}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-[var(--text-base)] font-black font-mono text-[var(--text-secondary)] opacity-40">
                            {formatKhr(totals.totalKhr)}
                        </p>
                    </div>
                </div>

                <button
                    className="btn-primary w-full py-4 text-sm font-black uppercase tracking-widest flex items-center justify-center shadow-lg shadow-[var(--accent)]/30"
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
