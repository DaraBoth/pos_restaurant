'use client';
import { useState, useEffect } from 'react';
import { useOrder } from '@/providers/OrderProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { checkoutOrder, checkoutSession, getOrderItems, getRestaurant, PaymentInput, OrderItem } from '@/lib/tauri-commands';
import { formatUsd, formatKhr, roundKhr, parseToCents, formatUsdNumeric } from '@/lib/currency';
import { X, CheckCircle, CreditCard, Banknote, QrCode, Tag, Printer } from 'lucide-react';
import useOverlayBehavior from '@/hooks/useOverlayBehavior';
import { printReceipt, ReceiptPrintPayload } from '@/lib/receipt';
import { canApplyDiscount } from '@/lib/permissions';

export default function CheckoutModal({
    onClose,
    onComplete
}: {
    onClose: () => void;
    onComplete: (payload: ReceiptPrintPayload) => void;
}) {
    const { orderId, totals, exchangeRate, clearOrder, items, tableId, sessionId, rounds, refreshRate, orderNote } = useOrder();
    const { user } = useAuth();
    const { t } = useLanguage();

    const [usdInput, setUsdInput] = useState<string>('');
    const [khrInput, setKhrInput] = useState<string>('');
    const [method, setMethod] = useState<'cash' | 'khqr' | 'card'>('cash');
    const [loading, setLoading] = useState(false);
    const [paymentError, setPaymentError] = useState<string>('');
    const [discountPct, setDiscountPct] = useState<number>(0);
    const [discountUsdInput, setDiscountUsdInput] = useState<string>('');
    const [discountMode, setDiscountMode] = useState<'pct' | 'fixed'>('pct');
    const [bakongReference, setBakongReference] = useState<string>('');

    const [combinedItems, setCombinedItems] = useState<OrderItem[]>(items);
    const [combinedTotals, setCombinedTotals] = useState(totals);
    const [completedPayload, setCompletedPayload] = useState<ReceiptPrintPayload | null>(null);
    const [customerNameInput, setCustomerNameInput] = useState('');

    useEffect(() => {
        refreshRate();
    }, [refreshRate]);

    // Combine all rounds for receipt view
    useEffect(() => {
        if (sessionId && rounds.length > 0) {
            Promise.all(rounds.map(r => getOrderItems(r.id, user?.restaurant_id || ''))).then(results => {
                const allItems = results.flat();
                const combined: Record<string, OrderItem> = {};
                let sumCents = 0;
                allItems.forEach(item => {
                    const key = `${item.product_id}_${item.price_at_order}`;
                    if (combined[key]) {
                        combined[key].quantity += item.quantity;
                    } else {
                        combined[key] = { ...item };
                    }
                    sumCents += item.price_at_order * item.quantity;
                });
                setCombinedItems(Object.values(combined));
                setCombinedTotals({
                    subtotalCents: sumCents,
                    vatCents: 0, pltCents: 0,
                    totalUsdCents: sumCents,
                    totalKhr: roundKhr(sumCents, exchangeRate)
                });
            });
        } else {
            setCombinedItems(items);
            setCombinedTotals(totals);
        }
    }, [sessionId, rounds, items, exchangeRate, totals]);

    useOverlayBehavior(true, onClose);

    // Discount + derived totals
    const fixedDiscountCents = discountMode === 'fixed' ? parseToCents(discountUsdInput) : 0;
    const discountCents = discountMode === 'pct'
        ? Math.round(combinedTotals.subtotalCents * discountPct / 100)
        : Math.min(fixedDiscountCents, combinedTotals.subtotalCents);
    const discountedTotals = {
        ...combinedTotals,
        subtotalCents: combinedTotals.subtotalCents - discountCents,
        totalUsdCents: combinedTotals.totalUsdCents - discountCents,
        totalKhr: roundKhr(combinedTotals.totalUsdCents - discountCents, exchangeRate),
    };

    // Split payment logic (applied against discounted total)
    const usdInputCents = usdInput ? parseToCents(usdInput) : 0;

    // Amount still owed
    const remainingUsdCents = Math.max(0, discountedTotals.totalUsdCents - usdInputCents);
    const remainingKhr = roundKhr(remainingUsdCents, exchangeRate);

    // Change due if they overpay in USD cash
    const changeUsdCents = Math.max(0, usdInputCents - discountedTotals.totalUsdCents);

    // Cash underpayment guard: only applies when method is cash and some USD has been entered
    const isUnderpaid = method === 'cash' && usdInputCents > 0 && usdInputCents < discountedTotals.totalUsdCents;
    const shortfallCents = isUnderpaid ? discountedTotals.totalUsdCents - usdInputCents : 0;

    const khrInputRiels = parseInt(khrInput) || 0;
    const khrChangeRiels = khrInputRiels > 0 ? khrInputRiels - discountedTotals.totalKhr : 0;
    const isKhrUnderpaid = khrInputRiels > 0 && khrInputRiels < discountedTotals.totalKhr;
    const mixedCashWarning = usdInputCents > 0 && khrInputRiels > 0;

    async function handleConfirm() {
        if (!orderId) return;
        setLoading(true);

        try {
            const payments: PaymentInput[] = [];

            if (khrInputRiels > 0 && usdInputCents === 0) {
                // KHR cash only
                payments.push({
                    method: 'cash',
                    currency: 'KHR',
                    amount: Math.min(khrInputRiels, discountedTotals.totalKhr)
                });
            } else {
                if (usdInputCents > 0) {
                    // They paid some/all in USD Cash
                    payments.push({
                        method: 'cash',
                        currency: 'USD',
                        amount: Math.min(usdInputCents, discountedTotals.totalUsdCents)
                    });
                }

                if (remainingUsdCents > 0) {
                    if (method === 'khqr') {
                        payments.push({
                            method: 'khqr',
                            currency: 'KHR',
                            amount: remainingKhr,
                            bakong_transaction_hash: bakongReference.trim() || undefined
                        });
                    } else {
                        payments.push({
                            method,
                            currency: 'USD',
                            amount: remainingUsdCents
                        });
                    }
                }
            }

            let customerName, customerPhone, receiptNumber: string | undefined;
            let takeoutCounter: number | undefined;
            if (sessionId) {
                await checkoutSession(sessionId, payments, user?.restaurant_id || '', discountCents);
                const currentOrder = rounds.find(r => r.id === orderId);
                customerName = currentOrder?.customer_name;
                customerPhone = currentOrder?.customer_phone;
            } else {
                const completedOrder = await checkoutOrder(orderId, payments, user?.restaurant_id || '', discountCents, customerNameInput || undefined, orderNote || undefined);
                customerName = completedOrder.customer_name;
                customerPhone = completedOrder.customer_phone;
                receiptNumber = completedOrder.receipt_number ?? undefined;
                takeoutCounter = completedOrder.takeout_counter ?? undefined;
            }

            const restaurant = await getRestaurant(user?.restaurant_id || '');
            const changeKhr = changeUsdCents > 0 ? Math.round(changeUsdCents / 100 * exchangeRate) : undefined;
            const payload: ReceiptPrintPayload = {
                restaurant,
                orderId,
                receiptNumber,
                tableId,
                customerName: customerName,
                customerPhone: customerPhone,
                cashierName: user?.full_name || user?.username,
                receivedCents: usdInputCents > 0 ? usdInputCents : undefined,
                receivedKhr: khrInputRiels > 0 && usdInputCents === 0 ? khrInputRiels : undefined,
                changeCents: changeUsdCents > 0 ? changeUsdCents : undefined,
                changeKhr: changeUsdCents > 0 ? changeKhr : (khrChangeRiels > 0 ? khrChangeRiels : undefined),
                discountPct: discountMode === 'pct' && discountPct > 0 ? discountPct : undefined,
                discountCents: discountCents > 0 ? discountCents : undefined,
                takeoutCounter,
                items: combinedItems,
                payments,
                totals: discountedTotals,
            };
            clearOrder();
            setCompletedPayload(payload);
        } catch (e) {
            console.error(e);
            const msg = e instanceof Error ? e.message.toLowerCase() : String(e).toLowerCase();
            if (msg.includes('database') || msg.includes('sql')) {
                setPaymentError(t('paymentErrorDatabase'));
            } else {
                setPaymentError(t('paymentErrorGeneral'));
            }
        } finally {
            setLoading(false);
        }
    }

    function handlePreviewPrint() {
        if (!orderId) return;
        const payments: PaymentInput[] = [];
        if (usdInputCents > 0) {
            payments.push({
                method: 'cash',
                currency: 'USD',
                amount: Math.min(usdInputCents, discountedTotals.totalUsdCents)
            });
        }
        if (remainingUsdCents > 0) {
            if (method === 'khqr') {
                payments.push({
                    method: 'khqr',
                    currency: 'KHR',
                    amount: remainingKhr,
                    bakong_transaction_hash: bakongReference.trim() || undefined
                });
            } else {
                payments.push({
                    method,
                    currency: 'USD',
                    amount: remainingUsdCents
                });
            }
        }

        getRestaurant(user?.restaurant_id || '').then(restaurant => {
            const currentOrder = rounds.find(r => r.id === orderId);
            const payload: ReceiptPrintPayload = {
                restaurant,
                orderId,
                tableId,
                customerName: currentOrder?.customer_name,
                customerPhone: currentOrder?.customer_phone,
                cashierName: user?.full_name || user?.username,
                receivedCents: usdInputCents > 0 ? usdInputCents : undefined,
                discountPct: discountMode === 'pct' && discountPct > 0 ? discountPct : undefined,
                discountCents: discountCents > 0 ? discountCents : undefined,
                items: combinedItems,
                payments,
                totals: discountedTotals,
            };
            printReceipt(payload);
        });
    }

    if (completedPayload) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                <div className="bg-[var(--bg-card)] rounded-2xl w-full max-w-sm shadow-2xl border border-[var(--border)] flex flex-col items-center gap-6 p-8">
                    <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center">
                        <CheckCircle size={32} className="text-green-400" strokeWidth={2} />
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-black text-[var(--foreground)] uppercase tracking-widest mb-1">{t('paymentConfirmed')}</p>
                        {completedPayload.receiptNumber && (
                            <p className="text-xs text-[var(--text-secondary)]">#{completedPayload.receiptNumber}</p>
                        )}
                    </div>
                    <div className="flex gap-3 w-full">
                        <button
                            onClick={() => { printReceipt(completedPayload); onComplete(completedPayload); }}
                            className="flex-1 py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 uppercase tracking-wider border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--foreground)] hover:bg-[var(--bg-dark)] transition-all"
                        >
                            <Printer size={16} /> {t('printReceipt')}
                        </button>
                        <button
                            onClick={() => onComplete(completedPayload)}
                            className="flex-1 py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 uppercase tracking-wider pos-btn-primary transition-all"
                        >
                            {t('done')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay bg-black/60 backdrop-blur-md" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="bg-[var(--bg-card)] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-[var(--border)]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)]">
                    <h2 className="text-sm font-black text-[var(--foreground)] uppercase tracking-widest">{t('checkout')}</h2>
                    <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 md:flex gap-5">

                    {/* Left Summary */}
                    <div className="flex-1 space-y-4">
                        <div className="bg-[var(--bg-elevated)] rounded-xl p-4 border border-[var(--border)]">
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] mb-1.5 opacity-60 text-[var(--text-secondary)]">{t('total')}</div>
                            {discountCents > 0 && (
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-sm font-mono text-[var(--text-secondary)] line-through opacity-60">{formatUsd(combinedTotals.totalUsdCents)}</span>
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-yellow-500/15 border border-yellow-500/30 text-yellow-600">
                                        {discountMode === 'pct' ? `-${discountPct}%` : `-${formatUsd(discountCents)}`}
                                    </span>
                                </div>
                            )}
                            <div className="text-3xl font-black font-mono text-[var(--foreground)] tracking-tighter leading-none">
                                {formatUsd(discountedTotals.totalUsdCents)}
                            </div>
                            <div className="text-base font-bold font-mono text-[var(--text-secondary)] opacity-60 mt-1">
                                {formatKhr(discountedTotals.totalKhr)}
                            </div>
                            <div className="text-[10px] font-bold text-[var(--text-secondary)] opacity-40 mt-0.5">
                                $1 = {formatKhr(Math.round(exchangeRate))}
                            </div>
                            {discountCents > 0 && (
                                <div className="mt-1.5 text-[10px] font-bold text-yellow-600">
                                    Saving {formatUsd(discountCents)}
                                    <span className="opacity-70 ml-1">≈ {formatKhr(roundKhr(discountCents, exchangeRate))}</span>
                                </div>
                            )}
                        </div>

                        {/* Discount — admin/manager only */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="flex items-center gap-1.5 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest opacity-60">
                                    <Tag size={10} />
                                    Discount
                                </label>
                                {canApplyDiscount(user?.role) && (
                                    <div className="flex rounded-lg overflow-hidden border border-[var(--border)]">
                                        <button
                                            onClick={() => setDiscountMode('pct')}
                                            className={`px-2 py-1 text-[9px] font-black transition-colors ${discountMode === 'pct' ? 'bg-yellow-500/20 text-yellow-600' : 'bg-[var(--bg-dark)] text-[var(--text-secondary)] hover:text-[var(--foreground)]'}`}
                                        >%</button>
                                        <button
                                            onClick={() => setDiscountMode('fixed')}
                                            className={`px-2 py-1 text-[9px] font-black transition-colors ${discountMode === 'fixed' ? 'bg-yellow-500/20 text-yellow-600' : 'bg-[var(--bg-dark)] text-[var(--text-secondary)] hover:text-[var(--foreground)]'}`}
                                        >$</button>
                                    </div>
                                )}
                            </div>
                            {canApplyDiscount(user?.role) ? (
                                discountMode === 'pct' ? (
                                    <div className="flex items-center gap-2">
                                        <div className="relative w-20 flex-shrink-0">
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="1"
                                                value={discountPct === 0 ? '' : discountPct}
                                                onChange={e => {
                                                    const v = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                                    setDiscountPct(v);
                                                }}
                                                placeholder="0"
                                                className="w-full bg-[var(--bg-dark)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm font-mono font-black text-[var(--foreground)] focus:border-yellow-500/60 outline-none transition-all"
                                            />
                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm font-black text-[var(--text-secondary)]/50">%</span>
                                        </div>
                                        <div className="flex gap-1 flex-1">
                                            {[5, 10, 15, 20, 50].map(pct => (
                                                <button
                                                    key={pct}
                                                    onClick={() => setDiscountPct(discountPct === pct ? 0 : pct)}
                                                    className={`flex-1 py-2 rounded-lg text-[10px] font-black border transition-colors ${
                                                        discountPct === pct
                                                            ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-600'
                                                            : 'bg-[var(--bg-dark)] border-[var(--border)] text-[var(--text-secondary)] hover:text-yellow-600 hover:bg-yellow-500/10 hover:border-yellow-500/25'
                                                    }`}
                                                >
                                                    {pct}%
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-[var(--text-secondary)]/50">$</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={discountUsdInput}
                                            onChange={e => setDiscountUsdInput(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full bg-[var(--bg-dark)] border border-[var(--border)] rounded-xl pl-8 pr-4 py-2 text-sm font-mono font-black text-[var(--foreground)] focus:border-yellow-500/60 outline-none transition-all"
                                        />
                                    </div>
                                )
                            ) : (
                                <p className="text-[10px] text-[var(--text-secondary)] opacity-50 italic">{t('askManagerForDiscount')}</p>
                            )}
                        </div>

                        {!tableId && (
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest px-1 opacity-60">
                                    {t('customerName')}
                                </label>
                                <input
                                    type="text"
                                    value={customerNameInput}
                                    onChange={e => setCustomerNameInput(e.target.value)}
                                    placeholder={t('customerName')}
                                    className="w-full bg-[var(--bg-dark)] border border-[var(--border)] rounded-xl px-4 py-2 text-sm font-semibold text-[var(--foreground)] placeholder:text-[var(--text-secondary)]/50 focus:border-[var(--accent-blue)] outline-none transition-all"
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest px-1 opacity-60">{t('paymentMethod')}</label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { id: 'cash', label: t('cash'), icon: Banknote },
                                    { id: 'khqr', label: 'KHQR (Manual)', icon: QrCode },
                                    { id: 'card', label: t('card'), icon: CreditCard },
                                ].map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => setMethod(m.id as 'cash' | 'khqr' | 'card')}
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
                            {method === 'khqr' && (
                                <div className="rounded-xl border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/5 px-3 py-2.5 space-y-2 mt-1">
                                    <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                                        Ask the customer to scan your KHQR code. Once payment is confirmed on your phone, tap Confirm Payment. / សូមអោយអតិថិជនស្កេន KHQR របស់អ្នក។ នៅពេលការទូទាត់ត្រូវបានបញ្ជាក់ ចុច &ldquo;បញ្ជាក់ការទូទាត់&rdquo;។
                                    </p>
                                    <input
                                        type="text"
                                        value={bakongReference}
                                        onChange={e => setBakongReference(e.target.value)}
                                        placeholder="Bakong Reference (optional)"
                                        className="w-full bg-[var(--bg-dark)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-[var(--foreground)] placeholder:opacity-40 focus:outline-none focus:border-[var(--accent-blue)]/50"
                                    />
                                </div>
                            )}
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
                                        placeholder={formatUsdNumeric(discountedTotals.totalUsdCents)}
                                        value={usdInput}
                                        onChange={e => setUsdInput(e.target.value)}
                                        className="w-full bg-[var(--bg-dark)] border border-[var(--border)] rounded-xl pl-8 pr-4 py-3 text-xl font-mono font-black text-[var(--foreground)] focus:border-[var(--accent-blue)] outline-none transition-all"
                                    />
                                </div>
                                {/* Quick denomination buttons */}
                                <div className="flex gap-1.5 mt-2">
                                    {[5, 10, 20, 50, 100].map(v => (
                                        <button
                                            key={v}
                                            onClick={() => setUsdInput(v.toString())}
                                            className="flex-1 py-1.5 rounded-lg bg-[var(--bg-dark)] hover:bg-[var(--accent-blue)]/15 text-xs font-black border border-[var(--border)] hover:border-[var(--accent-blue)]/40 transition-colors text-[var(--text-secondary)] hover:text-[var(--accent-blue)]"
                                        >
                                            {v}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {changeUsdCents > 0 ? (
                                <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/25">
                                    <div className="text-xs font-bold text-green-600">{t('change')}</div>
                                    <div className="text-xl font-black font-mono text-green-700">{formatUsd(changeUsdCents)}</div>
                                </div>
                            ) : remainingUsdCents > 0 && usdInputCents > 0 ? (
                                <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/25">
                                    <div className="text-xs font-bold text-orange-600">Remaining via {method.toUpperCase()}</div>
                                    <div className="text-xl font-black font-mono text-orange-700">{formatUsd(remainingUsdCents)}</div>
                                    <div className="text-xs font-mono text-orange-600/70 mt-0.5">{formatKhr(remainingKhr)}</div>
                                </div>
                            ) : null}

                            {/* KHR Cash input */}
                            <div>
                                <label className="text-[10px] uppercase font-black tracking-widest text-[var(--text-secondary)] mb-2 block opacity-60">
                                    {t('khrCash')}
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-black text-[var(--text-secondary)]/50">៛</span>
                                    <input
                                        type="number"
                                        step="100"
                                        min="0"
                                        placeholder={discountedTotals.totalKhr.toLocaleString()}
                                        value={khrInput}
                                        onChange={e => setKhrInput(e.target.value.replace(/\D/g, ''))}
                                        className="w-full bg-[var(--bg-dark)] border border-[var(--border)] rounded-xl pl-8 pr-4 py-3 text-xl font-mono font-black text-[var(--foreground)] focus:border-amber-400/60 outline-none transition-all"
                                    />
                                </div>
                                {/* Quick KHR denomination buttons */}
                                <div className="flex gap-1.5 mt-2">
                                    {[1000, 2000, 5000, 10000, 20000].map(v => (
                                        <button
                                            key={v}
                                            onClick={() => setKhrInput(v.toString())}
                                            className="flex-1 py-1.5 rounded-lg bg-[var(--bg-dark)] hover:bg-amber-500/15 text-[9px] font-black border border-[var(--border)] hover:border-amber-400/40 transition-colors text-[var(--text-secondary)] hover:text-amber-400"
                                        >
                                            {(v / 1000).toFixed(0)}K
                                        </button>
                                    ))}
                                </div>
                                {mixedCashWarning && (
                                    <p className="text-[10px] text-amber-400 font-bold mt-1.5 text-center">{t('mixedCashWarning')}</p>
                                )}
                                {khrChangeRiels > 0 && !mixedCashWarning && (
                                    <div className="mt-2 p-3 rounded-xl bg-green-500/10 border border-green-500/25">
                                        <div className="text-xs font-bold text-green-600">{t('change')}</div>
                                        <div className="text-xl font-black font-mono text-green-700">{formatKhr(khrChangeRiels)}</div>
                                    </div>
                                )}
                                {isKhrUnderpaid && !mixedCashWarning && (
                                    <p className="text-[10px] text-red-400 font-bold mt-1.5 text-center">
                                        Short {formatKhr(discountedTotals.totalKhr - khrInputRiels)}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={handlePreviewPrint}
                                disabled={loading}
                                className="w-14 h-14 rounded-xl flex items-center justify-center bg-[var(--bg-dark)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/30 transition-all active:scale-[0.95]"
                                title="Print Preview"
                            >
                                <Printer size={20} />
                            </button>
                            <div className="flex-1 flex flex-col gap-1">
                                {isUnderpaid && (
                                    <p className="text-[10px] text-red-400 font-bold text-center">
                                        {t('paymentShort')} {formatUsd(shortfallCents)}
                                    </p>
                                )}
                                {paymentError && (
                                    <p className="text-[10px] text-red-400 font-bold text-center leading-snug">
                                        {paymentError}
                                    </p>
                                )}
                                <button
                                    onClick={handleConfirm}
                                    disabled={loading || isUnderpaid || isKhrUnderpaid || mixedCashWarning}
                                    className="pos-btn-primary w-full py-4 rounded-xl text-sm font-black flex items-center justify-center gap-2.5 uppercase tracking-widest active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
            </div>
        </div>
        </>
    );
}

