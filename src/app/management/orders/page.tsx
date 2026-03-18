'use client';
import React, { useState, useEffect } from 'react';
import { getOrders, getOrderItems, Order, OrderItem } from '@/lib/tauri-commands';
import { formatUsd, formatKhr } from '@/lib/currency';
import {
    Search, Calendar, Filter, Download, ChevronDown,
    ChevronUp, ReceiptText, Clock, User, Trash2, CheckCircle, Package, ClipboardList
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export default function OrdersManagement() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedRows, setExpandedRows] = useState<string[]>([]);
    const [orderDetails, setOrderDetails] = useState<Record<string, OrderItem[]>>({});

    // Default to today
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        loadOrders();
    }, [startDate, endDate]);

    async function loadOrders() {
        setLoading(true);
        try {
            const data = await getOrders(undefined, startDate, endDate);
            setOrders(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function toggleRow(orderId: string) {
        setExpandedRows(prev => {
            if (prev.includes(orderId)) {
                return prev.filter(id => id !== orderId);
            } else {
                return [...prev, orderId];
            }
        });

        if (!orderDetails[orderId]) {
            try {
                const items = await getOrderItems(orderId);
                setOrderDetails(prev => ({ ...prev, [orderId]: items }));
            } catch (e) {
                console.error('Failed to load order items:', e);
            }
        }
    }

    const handleExport = () => {
        const data = orders.map(o => ({
            'Order ID': o.id.split('-')[0].toUpperCase(),
            'Table': o.table_id || 'Takeout',
            'Subtotal ($)': ((o.total_usd - o.tax_vat - o.tax_plt) / 100).toFixed(2),
            'Total ($)': (o.total_usd / 100).toFixed(2),
            'Status': o.status,
            'Date': new Date(o.created_at).toLocaleString(),
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Orders');
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `Orders_${startDate}_to_${endDate}.xlsx`);
    };

    const totalRevenue = orders.filter(o => o.status === 'completed').reduce((sum, o) => sum + o.total_usd, 0);

    return (
        <div className="max-w-7xl mx-auto animate-fade-in space-y-6">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-[var(--bg-card)] p-8 rounded-[2.5rem] border border-[var(--border)] shadow-xl">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-[var(--accent)]/10">
                        <ClipboardList size={28} className="text-[var(--accent)]" strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-[var(--foreground)] tracking-tight mb-1">Order History</h1>
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-60">
                            Transaction Audit & Revenue Analytics
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 bg-[var(--background)] px-4 py-2 rounded-xl border border-[var(--border)]">
                        <input 
                            type="date" 
                            value={startDate} 
                            onChange={e => setStartDate(e.target.value)} 
                            className="bg-transparent text-sm font-black text-[var(--foreground)] outline-none"
                        />
                        <span className="text-[var(--text-secondary)] font-black text-xs">TO</span>
                        <input 
                            type="date" 
                            value={endDate} 
                            onChange={e => setEndDate(e.target.value)} 
                            className="bg-transparent text-sm font-black text-[var(--foreground)] outline-none"
                        />
                    </div>

                    <button 
                        onClick={handleExport}
                        className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-all font-black text-xs uppercase tracking-widest"
                    >
                        <Download size={16} />
                        Export Excel
                    </button>

                    <div className="hidden md:flex items-center gap-5 px-6 py-3 rounded-2xl bg-[var(--background)] border border-[var(--border)]">
                        <div>
                            <span className="block text-[8px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-1 opacity-60">Audit Count</span>
                            <span className="block text-xl font-black font-mono text-[var(--foreground)] leading-none">{orders.length}</span>
                        </div>
                        <div className="w-px h-8 bg-[var(--border)]" />
                        <div>
                            <span className="block text-[8px] font-black uppercase tracking-[0.2em] text-[var(--accent)] mb-1 opacity-60">Gross Revenue</span>
                            <span className="block text-xl font-black font-mono text-[var(--accent)] leading-none">
                                {formatUsd(totalRevenue)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Data Grid */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[2.5rem] overflow-hidden shadow-2xl relative">
                {loading && (
                    <div className="absolute inset-x-0 top-0 h-1 bg-[var(--accent)]/20 overflow-hidden z-30">
                        <div className="h-full bg-[var(--accent)] animate-[loading_1.5s_infinite_linear]" style={{ width: '30%' }} />
                    </div>
                )}
                
                <div className="overflow-x-auto container-snap">
                    <table className="w-full text-left">
                        <thead className="bg-[var(--bg-elevated)]">
                            <tr>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] border-b border-[var(--border)] w-20"></th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] border-b border-[var(--border)]">Receipt ID</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] border-b border-[var(--border)]">Timestamp</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] border-b border-[var(--border)]">Status</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] border-b border-[var(--border)] text-right">Settlement</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                            {orders.map(o => {
                                const isExpanded = expandedRows.includes(o.id);
                                return (
                                    <React.Fragment key={o.id}>
                                        <tr 
                                            onClick={() => toggleRow(o.id)}
                                            className={`transition-all hover:bg-white/[0.03] cursor-pointer group ${isExpanded ? 'bg-white/[0.02]' : ''}`}
                                        >
                                            <td className="px-8 py-6">
                                                <div className={`p-2 rounded-xl transition-all ${isExpanded ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] group-hover:bg-[var(--accent)]/10 group-hover:text-[var(--accent)]'}`}>
                                                    {isExpanded ? <ChevronUp size={16} strokeWidth={3} /> : <ChevronDown size={16} strokeWidth={3} />}
                                                </div>
                                            </td>
                                            
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-3">
                                                    <span className={`font-mono font-black tracking-widest text-sm ${isExpanded ? 'text-[var(--accent)]' : 'text-[var(--foreground)]'}`}>
                                                        #{o.id.split('-')[0].toUpperCase()}
                                                    </span>
                                                </div>
                                            </td>
                                            
                                            <td className="px-8 py-6">
                                                <div className="text-sm font-black text-[var(--foreground)] mb-0.5">
                                                    {new Date(o.created_at + 'Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </div>
                                                <div className="text-[10px] font-black font-mono text-[var(--text-secondary)] flex items-center gap-1.5 opacity-60">
                                                    <Clock size={12} strokeWidth={2.5} />
                                                    {new Date(o.created_at + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </td>
                                            
                                            <td className="px-8 py-6">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border
                                                    ${o.status === 'completed' ? 'bg-green-500/10 text-green-500 border-green-500/20' : ''}
                                                    ${o.status === 'open' ? 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/20' : ''}
                                                    ${o.status === 'void' ? 'bg-red-500/10 text-red-500 border-red-500/20' : ''}
                                                `}>
                                                    {o.status === 'completed' && <CheckCircle size={12} strokeWidth={3} />}
                                                    {o.status === 'open' && <Clock size={12} strokeWidth={3} />}
                                                    {o.status === 'void' && <Trash2 size={12} strokeWidth={3} />}
                                                    {o.status}
                                                </span>
                                            </td>
                                            
                                            <td className="px-8 py-6 text-right">
                                                <div className={`font-black font-mono text-base ${o.status === 'void' ? 'line-through text-[var(--text-secondary)] opacity-40' : 'text-[var(--foreground)]'}`}>
                                                    {formatUsd(o.total_usd)}
                                                </div>
                                                <div className={`text-[10px] font-black font-mono mt-0.5 ${o.status === 'void' ? 'line-through text-[var(--text-secondary)]/30' : 'text-[var(--accent)] opacity-80'}`}>
                                                    {formatKhr(o.total_khr)}
                                                </div>
                                            </td>
                                        </tr>

                                        {isExpanded && (
                                            <tr className="bg-black/40 animate-fade-in border-l-4 border-[var(--accent)]">
                                                <td colSpan={5} className="px-12 py-8">
                                                    <div className="space-y-6">
                                                        <div className="flex items-center justify-between">
                                                            <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-[var(--accent)]">Order Specification</h4>
                                                            <div className="h-px flex-1 mx-8 bg-[var(--border)] opacity-20" />
                                                        </div>
                                                        
                                                        {orderDetails[o.id] ? (
                                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                                {orderDetails[o.id].map(item => (
                                                                    <div key={item.id} className="flex items-center justify-between bg-[var(--bg-elevated)] p-5 rounded-2xl border border-[var(--border)]">
                                                                        <div className="flex items-center gap-4">
                                                                            <div className="w-10 h-10 rounded-xl bg-[var(--background)] flex items-center justify-center font-black text-[var(--accent)] border border-[var(--border)]">
                                                                                {item.quantity}x
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-sm font-black text-[var(--foreground)] leading-tight">{item.product_name}</p>
                                                                                <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mt-1">{formatUsd(item.price_at_order)} / Unit</p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <p className="text-sm font-black text-[var(--foreground)]">{formatUsd(item.price_at_order * item.quantity)}</p>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-center py-10 opacity-30">
                                                                <div className="w-6 h-6 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
