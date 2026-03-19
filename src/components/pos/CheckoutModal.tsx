'use client';
import { useState } from 'react';
import { useOrder } from '@/providers/OrderProvider';
import { useLanguage } from '@/providers/LanguageProvider';
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay bg-black/60 backdrop-blur-md" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="bg-[var(--bg-card)] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-[var(--border)]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)]">
                    <h2 className="text-sm font-black text-[var(--foreground)] uppercase tracking-widest">{t('checkout')}</h2>
                    <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 md:flex gap-5">

                    {/* Left Summary */}
                    <div className="flex-1 space-y-4">
                        <div className="bg-[var(--bg-elevated)] rounded-xl p-4 border border-[var(--border)]">
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] mb-1.5 opacity-60 text-[var(--text-secondary)]">{t('total')}</div>
                            <div className="text-3xl font-black font-mono text-[var(--foreground)] tracking-tighter leading-none">
                                {formatUsd(totals.totalUsdCents)}
                            </div>
                            <div className="text-base font-bold font-mono text-[var(--text-secondary)] opacity-60 mt-1">
                                {formatKhr(totals.totalKhr)}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest px-1 opacity-60">{t('paymentMethod')}</label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { id: 'cash', label: t('cash'), icon: Banknote },
                                    { id: 'khqr', label: t('khqr'), icon: QrCode },
                                    { id: 'card', label: t('card'), icon: CreditCard },
                                ].map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => setMethod(m.id as any)}
                                        className={`flex flex-col items-center justify-center py-3 px-2 rounded-xl border-2 transition-all ${method === m.id
                                                    ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)]/10 text-[var(--foreground)]'
                                                : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--accent-blue)]/30'
                                            }`}
                                    >
                                        <m.icon size={18} className={`mb-1.5 ${method === m.id ? 'text-[var(--accent-blue)]' : ''}`} />
                                        <span className="text-[10px] font-black uppercase tracking-widest leading-tight text-center">{m.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Split Payment */}
                    <div className="flex-1 bg-[var(--bg-elevated)] rounded-xl p-4 border border-[var(--border)] mt-4 md:mt-0 flex flex-col gap-4">
                        <h3 className="text-xs font-black text-[var(--foreground)] uppercase tracking-widest">{t('splitPayment')}</h3>

                        <div className="space-y-3 flex-1">
                            <div>
                                <label className="text-[10px] uppercase font-black tracking-widest text-[var(--text-secondary)] mb-2 block opacity-60">Cash USD Received</label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-black text-[var(--text-secondary)]/50">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder={formatUsdNumeric(totals.totalUsdCents)}
                                        value={usdInput}
                                        onChange={e => setUsdInput(e.target.value)}
                                        className="w-full bg-white/[0.07] border border-white/20 rounded-xl pl-8 pr-4 py-3 text-xl font-mono font-black text-white focus:border-[var(--accent-blue)] outline-none transition-all"
                                    />
                                </div>
                                {/* Quick denomination buttons */}
                                <div className="flex gap-1.5 mt-2">
                                    {[5, 10, 20, 50, 100].map(v => (
                                        <button
                                            key={v}
                                            onClick={() => setUsdInput(v.toString())}
                                            className="flex-1 py-1.5 rounded-lg bg-white/[0.07] hover:bg-[var(--accent-blue)]/15 text-xs font-black border border-white/10 hover:border-[var(--accent-blue)]/40 transition-colors text-[var(--text-secondary)] hover:text-[var(--accent-blue)]"
                                        >
                                            {v}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {changeUsdCents > 0 ? (
                                <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/25">
                                    <div className="text-xs font-bold text-green-400">{t('change')}</div>
                                    <div className="text-xl font-black font-mono text-green-300">{formatUsd(changeUsdCents)}</div>
                                </div>
                            ) : remainingUsdCents > 0 && usdInputCents > 0 ? (
                                <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/25">
                                    <div className="text-xs font-bold text-orange-400">Remaining via {method.toUpperCase()}</div>
                                    <div className="text-xl font-black font-mono text-orange-300">{formatUsd(remainingUsdCents)}</div>
                                    <div className="text-xs font-mono text-orange-400/70 mt-0.5">{formatKhr(remainingKhr)}</div>
                                </div>
                            ) : null}
                        </div>

                        <button
                            onClick={handleConfirm}
                            disabled={loading}
                            className="pos-btn-primary w-full py-4 rounded-xl text-sm font-black flex items-center justify-center gap-2.5 uppercase tracking-widest active:scale-[0.98] transition-all"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <><CheckCircle size={18} strokeWidth={2.5} /> {t('confirmPayment')}</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
