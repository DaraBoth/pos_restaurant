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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-[#181a20] shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-8 py-6 border-b border-white/5 bg-[#0f1115]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
                            <History size={18} className="text-[var(--accent)]" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Table {tableId} Order History</h2>
                            <p className="text-sm text-[var(--text-secondary)]">Open and completed sessions for this table.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 text-[#8a8a99] transition-colors">
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
                        <div className="space-y-3">
                            {orders.map(order => (
                                <div key={order.id} className="rounded-2xl border border-white/5 bg-[#0f1115] p-5">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-bold text-white">Order #{order.id.split('-')[0].toUpperCase()}</p>
                                            <p className="text-xs text-[var(--text-secondary)] mt-1">
                                                {new Date(order.created_at + 'Z').toLocaleString()}
                                            </p>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                                            order.status === 'open'
                                                ? 'bg-orange-500/10 text-orange-400'
                                                : order.status === 'completed'
                                                    ? 'bg-green-500/10 text-green-400'
                                                    : 'bg-white/5 text-[#8a8a99]'
                                        }`}>
                                            {order.status}
                                        </span>
                                    </div>

                                    <div className="mt-4 flex items-end justify-between">
                                        <div>
                                            <p className="text-xs uppercase tracking-widest text-[var(--text-secondary)]">Total</p>
                                            <p className="font-mono text-lg font-bold text-white">{formatUsd(order.total_usd)}</p>
                                        </div>
                                        <p className="font-mono text-sm text-[var(--text-secondary)]">{formatKhr(order.total_khr)}</p>
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