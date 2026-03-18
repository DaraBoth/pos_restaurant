'use client';

import { useEffect, useState } from 'react';
import { X, History, RefreshCw } from 'lucide-react';
import useOverlayBehavior from '@/hooks/useOverlayBehavior';
import { getOrdersForTable, Order } from '@/lib/tauri-commands';
import { formatUsd, formatKhr } from '@/lib/currency';

interface TableOrderHistoryModalProps {
    isOpen: boolean;
    tableId: string;
    onClose: () => void;
}

export default function TableOrderHistoryModal({ isOpen, tableId, onClose }: TableOrderHistoryModalProps) {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);

    useOverlayBehavior(isOpen, onClose);

    useEffect(() => {
        if (!isOpen || !tableId) {
            return;
        }

        let cancelled = false;

        async function loadOrders() {
            setLoading(true);
            try {
                const data = await getOrdersForTable(tableId);
                if (!cancelled) {
                    setOrders(data);
                }
            } catch (error) {
                console.error(error);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadOrders();

        return () => {
            cancelled = true;
        };
    }, [isOpen, tableId]);

    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="w-full max-w-3xl rounded-[2.5rem] border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-[var(--space-unit)] py-8 border-b border-[var(--border)] bg-[var(--bg-elevated)]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
                            <History size={18} className="text-[var(--accent)]" />
                        </div>
                        <div>
                            <h2 className="text-[var(--text-xl)] font-black text-[var(--foreground)] uppercase tracking-tight">Table {tableId} History</h2>
                            <p className="text-[var(--text-xs)] font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-60">Open and completed sessions.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 rounded-2xl hover:bg-[var(--accent)]/10 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 max-h-[70vh] overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <RefreshCw size={22} className="animate-spin text-[var(--accent)]" />
                        </div>
                    ) : orders.length === 0 ? (
                        <div className="py-16 text-center text-[var(--text-secondary)] font-medium">
                            No orders have been created for this table yet.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {orders.map(order => (
                                <div key={order.id} className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--bg-elevated)] p-6 hover:border-[var(--accent)]/30 transition-colors">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-[var(--text-sm)] font-black text-[var(--foreground)] uppercase tracking-widest">Order #{order.id.split('-')[0].toUpperCase()}</p>
                                            <p className="text-[var(--text-xs)] font-bold text-[var(--text-secondary)] mt-1 opacity-60">
                                                {new Date(order.created_at + 'Z').toLocaleString()}
                                            </p>
                                        </div>
                                        <span className={`px-4 py-1.5 rounded-full text-[var(--text-xs)] font-black uppercase tracking-[0.2em] border ${
                                            order.status === 'open'
                                                ? 'bg-orange-500/10 text-orange-600 border-orange-500/20'
                                                : order.status === 'completed'
                                                    ? 'bg-green-500/10 text-green-600 border-green-500/20'
                                                    : 'bg-[var(--bg-dark)] text-[var(--text-secondary)] border-[var(--border)]'
                                        }`}>
                                            {order.status}
                                        </span>
                                    </div>

                                    <div className="mt-6 flex items-end justify-between">
                                        <div>
                                            <p className="text-[var(--text-xs)] uppercase font-black tracking-[0.2em] text-[var(--text-secondary)] mb-1 opacity-60">Total Paid</p>
                                            <p className="font-mono text-[var(--text-2xl)] font-black text-[var(--foreground)]">{formatUsd(order.total_usd)}</p>
                                        </div>
                                        <p className="font-mono text-[var(--text-base)] font-bold text-[var(--text-secondary)] opacity-80">{formatKhr(order.total_khr)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}