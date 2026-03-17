'use client';
import { useState } from 'react';
import { useOrder } from '@/contexts/OrderContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { checkoutOrder, getRestaurant, PaymentInput } from '@/lib/tauri-commands';
import { formatUsd, formatKhr, roundKhr, parseToCents, formatUsdNumeric } from '@/lib/currency';
import { X, CheckCircle, CreditCard, Banknote, QrCode } from 'lucide-react';
import useOverlayBehavior from '@/hooks/useOverlayBehavior';
import { printReceipt } from '@/lib/receipt';

export default function CheckoutModal({
    onClose,
    onComplete
}: {
    onClose: () => void;
    onComplete: () => void;
}) {
    const { orderId, totals, exchangeRate, clearOrder, items, tableId } = useOrder();
    const { t } = useLanguage();

    const [usdInput, setUsdInput] = useState<string>('');
    const [method, setMethod] = useState<'cash' | 'khqr' | 'card'>('cash');
    const [loading, setLoading] = useState(false);

    useOverlayBehavior(true, onClose);

    // Split payment logic
    // If user enters $5.00 cash on a $12.50 order, the remaining $7.50 is shown in KHR (or USD)
    const usdInputCents = usdInput ? parseToCents(usdInput) : 0;

    // Amount still owed
    const remainingUsdCents = Math.max(0, totals.totalUsdCents - usdInputCents);
    const remainingKhr = roundKhr(remainingUsdCents, exchangeRate);

    // Change due if they overpay in USD cash
    const changeUsdCents = Math.max(0, usdInputCents - totals.totalUsdCents);

    async function handleConfirm() {
        if (!orderId) return;
        setLoading(true);

        try {
            const payments: PaymentInput[] = [];

            if (usdInputCents > 0) {
                // They paid some/all in USD Cash
                payments.push({
                    method: 'cash',
                    currency: 'USD',
                    amount: Math.min(usdInputCents, totals.totalUsdCents) // cap at total
                });
            }

            if (remainingUsdCents > 0) {
                // For the remainder, they pay using the selected method (typically KHQR)
                // We log it as KHR if method is KHQR, otherwise USD for card/cash
                if (method === 'khqr') {
                    payments.push({
                        method: 'khqr',
                        currency: 'KHR',
                        amount: remainingKhr,
                        bakong_transaction_hash: 'PENDING-APP-VERIFY'
                    });
                } else {
                    payments.push({
                        method,
                        currency: 'USD',
                        amount: remainingUsdCents
                    });
                }
            }

            await checkoutOrder(orderId, payments);
            const restaurant = await getRestaurant();
            printReceipt({
                restaurant,
                orderId,
                tableId,
                items,
                payments,
                totals,
            });
            clearOrder();
            onComplete();
        } catch (e) {
            console.error(e);
            alert(t('error'));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay bg-black/80 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="glass bg-[var(--bg-card)] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-elevated)]">
                    <h2 className="text-xl font-bold">{t('checkout')}</h2>
                    <button onClick={onClose} className="p-2 text-[var(--text-secondary)] hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 md:flex gap-8">

                    {/* Left Summary */}
                    <div className="flex-1 space-y-6">
                        <div className="bg-[var(--bg-dark)] rounded-xl p-6 border border-[var(--border)]">
                            <div className="text-[var(--text-secondary)] text-sm mb-1">{t('total')}</div>
                            <div className="text-4xl font-black font-mono text-[var(--accent)] mb-2">
                                {formatUsd(totals.totalUsdCents)}
                            </div>
                            <div className="text-lg font-bold font-mono text-white opacity-90">
                                {formatKhr(totals.totalKhr)}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-sm font-semibold text-[var(--text-secondary)]">{t('paymentMethod')}</label>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { id: 'cash', label: t('cash'), icon: Banknote },
                                    { id: 'khqr', label: t('khqr'), icon: QrCode },
                                    { id: 'card', label: t('card'), icon: CreditCard },
                                ].map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => setMethod(m.id as any)}
                                        className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${method === m.id
                                                ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                                                : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-white/20'
                                            }`}
                                    >
                                        <m.icon size={24} className="mb-2" />
                                        <span className="text-xs font-semibold">{m.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Split Payment */}
                    <div className="flex-1 bg-[var(--bg-elevated)] rounded-xl p-6 border border-[var(--border)] mt-6 md:mt-0 flex flex-col">
                        <h3 className="font-semibold mb-4">{t('splitPayment')}</h3>

                        <div className="space-y-4 flex-1">
                            <div>
                                <label className="text-xs text-[var(--text-secondary)] mb-1 block">Cash USD Received (Optional)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-[var(--text-secondary)]">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder={formatUsdNumeric(totals.totalUsdCents)}
                                        value={usdInput}
                                        onChange={e => setUsdInput(e.target.value)}
                                        className="input-dark w-full pl-8 pr-4 py-4 rounded-xl text-xl font-mono"
                                    />
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-2">
                                        {[5, 10, 20, 50, 100].map(v => (
                                            <button
                                                key={v}
                                                onClick={() => setUsdInput(v.toString())}
                                                className="px-2 py-1 rounded bg-[var(--bg-dark)] hover:bg-[var(--border)] text-xs font-mono border border-[var(--border)] transition-colors"
                                            >
                                                +{v}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {changeUsdCents > 0 ? (
                                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400">
                                    <div className="text-sm">{t('change')}</div>
                                    <div className="text-2xl font-bold font-mono">{formatUsd(changeUsdCents)}</div>
                                </div>
                            ) : remainingUsdCents > 0 && usdInputCents > 0 ? (
                                <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400">
                                    <div className="text-sm">Remaining via {method.toUpperCase()}</div>
                                    <div className="text-2xl font-bold font-mono">{formatUsd(remainingUsdCents)}</div>
                                    <div className="text-sm font-mono opacity-80">{formatKhr(remainingKhr)}</div>
                                </div>
                            ) : null}
                        </div>

                        <button
                            onClick={handleConfirm}
                            disabled={loading}
                            className="btn-primary w-full py-4 rounded-xl text-lg font-bold flex items-center justify-center gap-2 mt-6 uppercase tracking-wider"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                            ) : (
                                <><CheckCircle size={20} /> {t('confirmPayment')}</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
