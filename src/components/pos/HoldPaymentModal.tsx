'use client';
import { useState } from 'react';
import { useOrder } from '@/providers/OrderProvider';
import { holdOrder } from '@/lib/tauri-commands';
import { PauseCircle, User, Phone, X } from 'lucide-react';

interface Props {
    onClose: () => void;
    onComplete: () => void;
}

export default function HoldPaymentModal({ onClose, onComplete }: Props) {
    const { orderId, tableId } = useOrder();
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleHold() {
        if (!orderId) return;
        setLoading(true);
        try {
            await holdOrder(orderId, customerName.trim() || undefined, customerPhone.trim() || undefined);
            onComplete();
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.65)' }}>
            <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-yellow-500/15 border border-yellow-500/30">
                            <PauseCircle size={16} className="text-yellow-400" />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-[var(--foreground)] leading-none">Hold for Payment</h2>
                            {tableId && (
                                <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Table {tableId}</p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--bg-elevated)] transition-colors"
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-5 py-4 space-y-3">
                    <p className="text-[11px] text-[var(--text-secondary)]">
                        Save customer info and mark the table as waiting for payment. The order stays open — pay later at checkout.
                    </p>

                    {/* Customer Name */}
                    <div className="space-y-1">
                        <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                            <User size={10} />
                            Customer Name
                        </label>
                        <input
                            type="text"
                            value={customerName}
                            onChange={e => setCustomerName(e.target.value)}
                            placeholder="Optional"
                            className="w-full px-3 py-2 rounded-xl text-sm bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--text-secondary)]/50 outline-none focus:border-[var(--accent-blue)]/60 transition-colors"
                        />
                    </div>

                    {/* Customer Phone */}
                    <div className="space-y-1">
                        <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                            <Phone size={10} />
                            Phone Number
                        </label>
                        <input
                            type="tel"
                            value={customerPhone}
                            onChange={e => setCustomerPhone(e.target.value)}
                            placeholder="Optional"
                            className="w-full px-3 py-2 rounded-xl text-sm bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--text-secondary)]/50 outline-none focus:border-[var(--accent-blue)]/60 transition-colors"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 pb-5 flex items-center gap-2">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]/20 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleHold}
                        disabled={loading || !orderId}
                        className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/25 transition-all disabled:opacity-50 active:scale-95"
                    >
                        <PauseCircle size={13} strokeWidth={2.5} />
                        {loading ? 'Saving...' : 'Hold Order'}
                    </button>
                </div>
            </div>
        </div>
    );
}
