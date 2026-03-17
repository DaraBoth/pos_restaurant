'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { History, Search, ArrowUpRight, ArrowDownLeft, Package, Calendar, Filter } from 'lucide-react';
import { call } from '@/lib/tauri-commands';

interface InventoryLog {
    id: string;
    product_id: string;
    product_name: string;
    change_amount: number;
    reason: string;
    created_at: string;
}

export default function InventoryAuditing() {
    const [logs, setLogs] = useState<InventoryLog[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadLogs();
    }, []);

    async function loadLogs() {
        try {
            // Note: We'll need this command in Rust, but first let's see if we have it or need to add it
            const data = await call<InventoryLog[]>('get_inventory_logs');
            setLogs(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    const filteredLogs = logs.filter(log => 
        log.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.reason.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="max-w-7xl mx-auto animate-fade-in space-y-6 pb-20">
            {/* Header Area */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-[#181a20] p-6 lg:p-8 rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-[100px] pointer-events-none" />
                
                <div className="flex items-center gap-6 relative z-10">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20 shadow-lg">
                        <History size={32} className="text-emerald-400" strokeWidth={2} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-white tracking-tight leading-none mb-2">Inventory Audit</h1>
                        <p className="text-sm font-bold text-[#8a8a99] uppercase tracking-widest opacity-60">
                            Stock Movement & History Tracking
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 relative z-10">
                    <div className="relative">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8a8a99]" />
                        <input 
                            type="text"
                            placeholder="Search by product or reason..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="bg-[#0f1115] border border-white/5 rounded-2xl pl-12 pr-6 py-3 text-sm text-white focus:border-emerald-500 outline-none transition-all w-full sm:w-80"
                        />
                    </div>
                </div>
            </div>

            {/* Logs Table */}
            <div className="bg-[#181a20] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl relative">
                <div className="overflow-x-auto container-snap">
                    <table className="w-full text-left whitespace-nowrap border-collapse">
                        <thead className="bg-[#0f1115]">
                            <tr>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#8a8a99] border-b border-white/5">Product</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#8a8a99] border-b border-white/5">Movement</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#8a8a99] border-b border-white/5">Reason</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#8a8a99] border-b border-white/5 text-right">Timestamp</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredLogs.map(log => (
                                <tr key={log.id} className="transition-colors hover:bg-white/[0.02] group">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-[#0f1115] border border-white/5 flex items-center justify-center group-hover:border-emerald-500/30 transition-colors">
                                                <Package size={20} className="text-[#8a8a99]" />
                                            </div>
                                            <div className="font-black text-white text-base tracking-tight">{log.product_name}</div>
                                        </div>
                                    </td>
                                    
                                    <td className="px-8 py-5">
                                        <div className={`flex items-center gap-2 font-mono font-bold ${log.change_amount > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {log.change_amount > 0 ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                                            {log.change_amount > 0 ? '+' : ''}{log.change_amount}
                                        </div>
                                    </td>
                                    
                                    <td className="px-8 py-5">
                                        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 text-[#8a8a99] text-[10px] font-black uppercase tracking-widest group-hover:text-white transition-colors">
                                            {log.reason}
                                        </span>
                                    </td>
                                    
                                    <td className="px-8 py-5 text-right">
                                        <div className="flex flex-col items-end opacity-60 group-hover:opacity-100 transition-opacity">
                                            <div className="text-sm font-black text-white tracking-tight">
                                                {new Date(log.created_at).toLocaleDateString()}
                                            </div>
                                            <div className="text-[10px] font-bold text-[#8a8a99] uppercase tracking-wider">
                                                {new Date(log.created_at).toLocaleTimeString()}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredLogs.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={4} className="px-8 py-20 text-center">
                                        <History size={48} className="mx-auto mb-4 text-[#8a8a99] opacity-20" />
                                        <p className="text-[#8a8a99] font-black uppercase tracking-widest text-xs">No movement history</p>
                                    </td>
                                </tr>
                            )}
                            {loading && (
                                <tr>
                                    <td colSpan={4} className="px-8 py-20 text-center">
                                        <div className="w-8 h-8 border-4 border-white/5 border-t-emerald-500 rounded-full animate-spin mx-auto" />
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
