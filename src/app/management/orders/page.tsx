'use client';
import { useState, useEffect } from 'react';
import { getOrders, Order } from '@/lib/tauri-commands';
import { formatUsd, formatKhr } from '@/lib/currency';

export default function OrdersManagement() {
    const [orders, setOrders] = useState<Order[]>([]);

    useEffect(() => {
        loadOrders();
    }, []);

    async function loadOrders() {
        try {
            const data = await getOrders(); // Fetch orders
            setOrders(data);
        } catch (e) {
            console.error(e);
        }
    }

    return (
        <div className="max-w-6xl mx-auto auto-fade-in relative z-10 space-y-6">
            <h1 className="text-3xl font-bold">Order History</h1>

            <div className="glass rounded-2xl border border-[var(--border)] overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-[var(--bg-dark)] border-b border-[var(--border)]">
                        <tr>
                            <th className="px-6 py-4 text-sm font-semibold text-[var(--text-secondary)]">Order #</th>
                            <th className="px-6 py-4 text-sm font-semibold text-[var(--text-secondary)]">Date & Time</th>
                            <th className="px-6 py-4 text-sm font-semibold text-[var(--text-secondary)]">Status</th>
                            <th className="px-6 py-4 text-sm font-semibold text-[var(--text-secondary)]">Cashier</th>
                            <th className="px-6 py-4 text-sm font-semibold text-[var(--text-secondary)] text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                        {orders.map(o => (
                            <tr key={o.id} className="hover:bg-[var(--bg-elevated)] transition-colors">
                                <td className="px-6 py-4 font-mono text-sm text-[var(--text-secondary)]">
                                    {o.id.split('-')[0].toUpperCase()}
                                </td>
                                <td className="px-6 py-4 text-sm">
                                    {new Date(o.created_at + 'Z').toLocaleString()}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide
                    ${o.status === 'completed' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : ''}
                    ${o.status === 'open' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : ''}
                    ${o.status === 'void' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : ''}
                  `}>
                                        {o.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">
                                    {o.user_id ? o.user_id.split('-')[0].toUpperCase() : 'N/A'}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="font-mono font-bold text-[var(--accent)]">{formatUsd(o.total_usd)}</div>
                                    <div className="text-xs font-mono text-[var(--text-secondary)]">{formatKhr(o.total_khr)}</div>
                                </td>
                            </tr>
                        ))}
                        {orders.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-[var(--text-secondary)]">
                                    No orders found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
