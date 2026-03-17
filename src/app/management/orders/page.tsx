'use client';
import { useState, useEffect } from 'react';
import { getOrders, Order } from '@/lib/tauri-commands';
import { formatUsd, formatKhr } from '@/lib/currency';
import { ClipboardList, ReceiptText, Clock, Trash2, CheckCircle2 } from 'lucide-react';

export default function OrdersManagement() {
    const [orders, setOrders] = useState<Order[]>([]);

    useEffect(() => {
        loadOrders();
    }, []);

    async function loadOrders() {
        try {
            const data = await getOrders();
            setOrders(data);
        } catch (e) {
            console.error(e);
        }
    }

    const totalRevenue = orders.filter(o => o.status === 'completed').reduce((sum, o) => sum + o.total_usd, 0);

    return (
        <div className="max-w-7xl mx-auto animate-fade-in space-y-6">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-[#181a20] p-6 rounded-2xl border border-white/5 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#3b82f6]/10">
                        <ClipboardList size={24} className="text-[#3b82f6]" strokeWidth={2} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-1">Order History</h1>
                        <p className="text-sm font-medium text-[var(--text-secondary)]">
                            Audit past receipts, refunds, and revenue
                        </p>
                    </div>
                </div>

                <div className="flex gap-4">
                    {/* Stats Pill */}
                    <div className="px-5 py-2.5 rounded-xl bg-[#0f1115] border border-white/5 flex items-center gap-5">
                        <div>
                            <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-0.5">Total Logs</span>
                            <span className="block text-xl font-bold font-mono text-white leading-none">{orders.length}</span>
                        </div>
                        <div className="w-px h-8 bg-white/10" />
                        <div>
                            <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#3b82f6] mb-0.5">Gross Revenue</span>
                            <span className="block text-xl font-bold font-mono text-[#3b82f6] leading-none">
                                {formatUsd(totalRevenue)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Data Grid */}
            <div className="bg-[#181a20] border border-white/5 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto container-snap">
                    <table className="w-full text-left whitespace-nowrap">
                        <thead className="bg-[#0f1115]">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] border-b border-white/5">Receipt ID</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] border-b border-white/5">Timestamp</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] border-b border-white/5">Order Status</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] border-b border-white/5">Staff / Cashier</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] border-b border-white/5 text-right">Settlement</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {orders.map(o => (
                                <tr key={o.id} className="transition-colors hover:bg-white/[0.02] group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-[#0f1115] border border-white/5 flex items-center justify-center text-[var(--text-secondary)]">
                                                <ReceiptText size={14} />
                                            </div>
                                            <span className="font-mono font-semibold text-white tracking-wide">
                                                #{o.id.split('-')[0].toUpperCase()}
                                            </span>
                                        </div>
                                    </td>
                                    
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-semibold text-white mb-0.5">
                                            {new Date(o.created_at + 'Z').toLocaleDateString()}
                                        </div>
                                        <div className="text-xs font-mono font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
                                            <Clock size={12} />
                                            {new Date(o.created_at + 'Z').toLocaleTimeString()}
                                        </div>
                                    </td>
                                    
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border
                                            ${o.status === 'completed' ? 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20' : ''}
                                            ${o.status === 'open' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : ''}
                                            ${o.status === 'void' ? 'bg-red-500/10 text-red-400 border-red-500/20' : ''}
                                        `}>
                                            {o.status === 'completed' && <CheckCircle2 size={14} />}
                                            {o.status === 'open' && <Clock size={14} />}
                                            {o.status === 'void' && <Trash2 size={14} />}
                                            {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                                        </span>
                                    </td>
                                    
                                    <td className="px-6 py-4">
                                        <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                                            {o.user_id ? o.user_id.split('-')[0].toUpperCase() : 'SYSTEM'}
                                        </span>
                                    </td>
                                    
                                    <td className="px-6 py-4 text-right">
                                        <div className={`font-mono font-bold text-sm ${o.status === 'void' ? 'line-through text-[var(--text-secondary)]' : 'text-[#3b82f6]'}`}>
                                            {formatUsd(o.total_usd)}
                                        </div>
                                        <div className={`text-xs font-mono font-medium mt-0.5 ${o.status === 'void' ? 'line-through text-white/20' : 'text-[var(--text-secondary)]'}`}>
                                            {formatKhr(o.total_khr)}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {orders.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-16 text-center">
                                        <ClipboardList size={40} className="mx-auto mb-3 text-[var(--text-secondary)] opacity-50" strokeWidth={1.5} />
                                        <p className="text-sm font-semibold text-[var(--text-secondary)]">No transaction logs found.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
