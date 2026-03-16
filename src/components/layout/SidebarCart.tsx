'use client';
import { useOrder } from '@/contexts/OrderContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { updateOrderItemQuantity, voidOrder, createOrder } from '@/lib/tauri-commands';
import { formatUsd, formatKhr } from '@/lib/currency';
import { Trash2, AlertCircle, Plus, Minus } from 'lucide-react';

export default function SidebarCart({
    onCheckout
}: {
    onCheckout: () => void
}) {
    const { items, totals, exchangeRate, orderId, clearOrder } = useOrder();
    const { t, lang } = useLanguage();

    async function handleQtyChange(id: string, current: number, delta: number) {
        if (!orderId) return;
        const nextQty = current + delta;
        if (nextQty < 0) return;
        try {
            await updateOrderItemQuantity(id, nextQty);
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
        <div className="w-96 flex-shrink-0 bg-[var(--bg-card)] border-l border-[var(--border)] flex flex-col h-full z-10 shadow-2xl sidebar-cart">
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-6 border-b border-[var(--border)] bg-[var(--bg-elevated)]">
                <h2 className="text-lg font-bold">{t('currentOrder')}</h2>
                {orderId && (
                    <button onClick={handleVoid} className="text-[var(--accent-red)] hover:text-red-400 p-2" title={t('voidOrder')}>
                        <Trash2 size={18} />
                    </button>
                )}
            </div>

            {/* Item List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {isEmpty ? (
                    <div className="h-full flex flex-col items-center justify-center text-[var(--text-secondary)] opacity-50 space-y-4">
                        <AlertCircle size={48} />
                        <div className="text-center">
                            <p className="font-semibold">{t('emptyOrder')}</p>
                            <p className="text-sm mt-1">{t('emptyOrderSub')}</p>
                        </div>
                    </div>
                ) : (
                    items.map(item => (
                        <div key={item.id} className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-3 flex flex-col gap-3 animate-fade-in relative overflow-hidden">
                            <div className="flex justify-between items-start gap-2">
                                <div className="flex-1">
                                    <h3 className={`font-semibold text-sm leading-tight ${lang === 'km' ? 'khmer' : ''}`}>
                                        {lang === 'km' ? (item.product_khmer || item.product_name) : item.product_name}
                                    </h3>
                                    <div className="text-[var(--accent)] text-sm mt-1 font-mono">
                                        {formatUsd(item.price_at_order)}
                                    </div>
                                </div>
                                <div className="font-mono text-base font-bold whitespace-nowrap pl-2">
                                    {formatUsd(item.price_at_order * item.quantity)}
                                </div>
                            </div>

                            <div className="flex items-center justify-between bg-[var(--bg-dark)] rounded-lg p-1 border border-[var(--border)]">
                                <button
                                    onClick={() => handleQtyChange(item.id, item.quantity, -1)}
                                    className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-red-500/20 text-red-400 transition-colors"
                                >
                                    {item.quantity === 1 ? <Trash2 size={14} /> : <Minus size={14} />}
                                </button>
                                <div className="font-bold font-mono text-center flex-1">{item.quantity}</div>
                                <button
                                    onClick={() => handleQtyChange(item.id, item.quantity, 1)}
                                    className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-green-500/20 text-green-400 transition-colors"
                                >
                                    <Plus size={14} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Totals & Checkout */}
            <div className="bg-[var(--bg-elevated)] border-t border-[var(--border)] p-6 space-y-4 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-20">
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-[var(--text-secondary)]">
                        <span>{t('subtotal')}</span>
                        <span className="font-mono">{formatUsd(totals.subtotalCents)}</span>
                    </div>
                    <div className="flex justify-between text-[var(--text-secondary)]">
                        <span>{t('vat')}</span>
                        <span className="font-mono">{formatUsd(totals.vatCents)}</span>
                    </div>
                    <div className="flex justify-between text-[var(--text-secondary)]">
                        <span>{t('plt')}</span>
                        <span className="font-mono">{formatUsd(totals.pltCents)}</span>
                    </div>
                </div>

                <div className="h-px bg-[var(--border)] my-4 w-full" />

                <div className="flex justify-between items-end">
                    <div>
                        <div className="text-[var(--text-secondary)] text-xs mb-1">
                            {t('total')}
                        </div>
                        <div className="text-3xl font-black text-white font-mono tracking-tight text-glow">
                            {formatUsd(totals.totalUsdCents)}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-[var(--text-secondary)] text-[10px] mb-1 opacity-70">
                            {t('exchangeRateLabel')} {exchangeRate.toLocaleString()} ៛
                        </div>
                        <div className="text-xl font-bold text-[var(--accent)] font-mono">
                            {formatKhr(totals.totalKhr)}
                        </div>
                    </div>
                </div>

                <button
                    className="btn-primary w-full py-4 rounded-xl text-lg font-bold uppercase tracking-wider mt-4 shadow-lg shadow-amber-500/20"
                    disabled={isEmpty || !orderId}
                    onClick={onCheckout}
                >
                    {t('checkout')}
                </button>
            </div>
        </div>
    );
}
