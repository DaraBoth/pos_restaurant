'use client';

import { useEffect, useState } from 'react';
import { X, History, RefreshCw, Receipt } from 'lucide-react';
import useOverlayBehavior from '@/hooks/useOverlayBehavior';
import { getSessionRounds, Order } from '@/lib/tauri-commands';
import { formatUsd, formatKhr } from '@/lib/currency';
import { useLanguage } from '@/providers/LanguageProvider';

interface TableOrderHistoryModalProps {
    isOpen: boolean;
    tableId: string;
    sessionId?: string | null;
    onClose: () => void;
}

export default function TableOrderHistoryModal({ isOpen, tableId, sessionId, onClose }: TableOrderHistoryModalProps) {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);
    const { t } = useLanguage();

    useOverlayBehavior(isOpen, onClose);

    useEffect(() => {
        if (!isOpen || !tableId) return;
        if (!sessionId) {
            setOrders([]);
            return;
        }
        let cancelled = false;
        async function loadOrders() {
            setLoading(true);
            try {
                const data = await getSessionRounds(sessionId as string);
                if (!cancelled) setOrders(data);
            } catch (error) {
                console.error(error);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        loadOrders();
        return () => { cancelled = true; };
    }, [isOpen, tableId, sessionId]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[var(--bg-card)] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-slide-up">
                
                {/* Header */}
                <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-dashed border-white/10 bg-[var(--bg-elevated)] relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-[var(--accent)]" />
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center">
                            <History size={14} className="text-[var(--accent)]" />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-[var(--foreground)] uppercase tracking-widest leading-tight">Table {tableId} History</h2>
                            <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em] opacity-60 mt-0.5">Session Archive</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 text-[var(--text-secondary)] hover:text-white transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3 no-scrollbar bg-[var(--bg-dark)]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 opacity-30">
                            <RefreshCw size={24} className="animate-spin text-[var(--accent)]" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Loading Archives...</span>
                        </div>
                    ) : orders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 opacity-30">
                            <Receipt size={32} />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">No history found</span>
                        </div>
                    ) : (
                        orders.map((order, idx) => {
                            const dt = new Date(order.created_at + 'Z');
                            const isVoid = order.status === 'void';
                            
                            // Map status to aesthetic pills
                            let statusClasses = 'bg-[var(--bg-dark)] text-[var(--text-secondary)] border-white/10';
                            let statusLabel: string = order.status;
                            
                            if (order.status === 'open') {
                                statusClasses = 'bg-orange-500/10 text-orange-400 border-orange-500/20';
                            } else if (order.status === 'completed') {
                                statusClasses = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                            } else if (isVoid) {
                                statusClasses = 'bg-red-500/10 text-red-400 border-red-500/20';
                                statusLabel = 'hold';
                            }

                            return (
                                <div key={order.id} className="group flex flex-col rounded-xl border border-white/5 bg-[var(--bg-elevated)] p-4 transition-all hover:border-[var(--accent)]/30 hover:bg-[var(--bg-card)]">
                                    <div className="flex items-start justify-between mb-3 border-b border-dashed border-white/5 pb-3">
                                        <div className="flex items-center gap-2.5">
                                            <span className="text-[10px] font-black text-[var(--accent)] uppercase tracking-widest bg-[var(--accent)]/10 px-2 py-0.5 rounded-md border border-[var(--accent)]/20">
                                                Round {orders.length - idx}
                                            </span>
                                            <span className="text-[10px] font-medium opacity-40 font-mono">
                                                {dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${statusClasses}`}>
                                            {statusLabel}
                                        </span>
                                    </div>

                                    <div className="flex items-end justify-between">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-xs font-mono font-black text-white/40 tracking-widest">
                                                #{order.id.split('-')[0].toUpperCase()}
                                            </span>
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-50">
                                                {dt.toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div className="text-right flex flex-col gap-0.5">
                                            <span className={`font-mono text-sm font-black ${isVoid ? 'line-through opacity-30 text-[var(--text-secondary)]' : 'text-[var(--accent)]'}`}>
                                                {formatUsd(order.total_usd)}
                                            </span>
                                            <span className={`font-mono text-[9px] font-bold opacity-40 ${isVoid ? 'line-through' : ''}`}>
                                                {formatKhr(order.total_khr)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}