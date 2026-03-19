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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay bg-black/55 backdrop-blur-md" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="bg-[var(--bg-card)] rounded-[1.4rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-[var(--border)]">
                {/* Header */}
                <div className="flex items-center justify-between px-[var(--space-unit)] py-5 border-b border-[var(--border)] bg-[#162230]">
                    <h2 className="text-xl font-black text-[var(--foreground)] uppercase tracking-tight">{t('checkout')}</h2>
                    <button onClick={onClose} className="p-2 text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 md:flex gap-8">

                    {/* Left Summary */}
                    <div className="flex-1 space-y-6">
                        <div className="bg-[#0f1822] rounded-2xl p-[var(--space-unit)] border border-[var(--border)]">
                            <div className="text-xs font-black uppercase tracking-[0.2em] mb-2 opacity-60 text-[var(--text-secondary)]">{t('total')}</div>
                            <div className="text-4xl font-black font-mono text-[var(--foreground)] mb-2 tracking-tighter leading-none">
                                {formatUsd(totals.totalUsdCents)}
                            </div>
                            <div className="text-xl font-bold font-mono text-[var(--text-secondary)] opacity-60">
                                {formatKhr(totals.totalKhr)}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-xs font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] px-1 opacity-60">{t('paymentMethod')}</label>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { id: 'cash', label: t('cash'), icon: Banknote },
                                    { id: 'khqr', label: t('khqr'), icon: QrCode },
                                    { id: 'card', label: t('card'), icon: CreditCard },
                                ].map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => setMethod(m.id as any)}
                                        className={`flex flex-col items-center justify-center p-[var(--space-unit)] rounded-2xl border-2 transition-all ${method === m.id
                                                    ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)]/12 text-[var(--foreground)] scale-[1.02] shadow-sm'
                                                : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--accent)]/30'
                                            }`}
                                    >
                                            <m.icon size={24} className={`mb-2 ${method === m.id ? 'text-[var(--accent-blue)]' : ''}`} />
                                        <span className="text-[var(--text-xs)] font-black uppercase tracking-widest">{m.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Split Payment */}
                        <div className="flex-1 bg-[#101a24] rounded-2xl p-[var(--space-unit)] border border-[var(--border)] mt-6 md:mt-0 flex flex-col">
                        <h3 className="text-[var(--text-sm)] font-black text-[var(--foreground)] uppercase tracking-[0.15em] mb-6 px-1">{t('splitPayment')}</h3>

                        <div className="space-y-6 flex-1">
                            <div>
                                <label className="text-[var(--text-xs)] uppercase font-black tracking-[0.2em] text-[var(--text-secondary)] mb-2 block px-1 opacity-60">Cash USD Received</label>
                                <div className="relative">
                                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-xl)] font-black text-[var(--text-secondary)]/40">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder={formatUsdNumeric(totals.totalUsdCents)}
                                        value={usdInput}
                                        onChange={e => setUsdInput(e.target.value)}
                                        className="w-full pos-input pl-10 pr-4 py-4 text-[var(--text-2xl)] font-mono font-black"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1.5">
                                        {[5, 10, 20, 50, 100].map(v => (
                                            <button
                                                key={v}
                                                onClick={() => setUsdInput(v.toString())}
                                                className="px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--accent-blue)]/12 text-[var(--text-xs)] font-black border border-[var(--border)] transition-colors text-[var(--text-secondary)] hover:text-[var(--accent-blue)]"
                                            >
                                                {v}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {changeUsdCents > 0 ? (
                                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-600">
                                    <div className="text-[var(--text-sm)] font-bold">{t('change')}</div>
                                    <div className="text-[var(--text-2xl)] font-black font-mono">{formatUsd(changeUsdCents)}</div>
                                </div>
                            ) : remainingUsdCents > 0 && usdInputCents > 0 ? (
                                <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-600">
                                    <div className="text-[var(--text-sm)] font-bold">Remaining via {method.toUpperCase()}</div>
                                    <div className="text-[var(--text-2xl)] font-black font-mono">{formatUsd(remainingUsdCents)}</div>
                                    <div className="text-[var(--text-sm)] font-mono opacity-80">{formatKhr(remainingKhr)}</div>
                                </div>
                            ) : null}
                        </div>

                        <button
                            onClick={handleConfirm}
                            disabled={loading}
                            className="pos-btn-primary w-full py-5 rounded-[1.1rem] text-[var(--text-lg)] font-black flex items-center justify-center gap-3 mt-8 uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                            {loading ? (
                                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <><CheckCircle size={22} strokeWidth={3} /> {t('confirmPayment')}</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
