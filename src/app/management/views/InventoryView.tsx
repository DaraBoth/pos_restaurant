'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/providers/LanguageProvider';
import { getInventoryItems, deleteInventoryItem } from '@/lib/api/inventory';
import { useAuth } from '@/providers/AuthProvider';
import { 
    BoxesIcon, Search, AlertTriangle, 
    Plus, Package, Trash2, Edit2, 
    ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import InventoryItemModal from '@/components/management/InventoryItemModal';
import { InventoryItem } from '@/types';

export default function InventoryView() {
    const { t, lang } = useLanguage();
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showLowOnly, setShowLowOnly] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [loading, setLoading] = useState(false);
    
    const { user } = useAuth();
    const restaurantId = user?.restaurant_id;

    useEffect(() => {
        loadData();
    }, [restaurantId]);

    async function loadData() {
        if (!restaurantId) return;
        setLoading(true);
        try {
            const data = await getInventoryItems(restaurantId);
            setItems(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete(id: string) {
        if (!window.confirm('Are you sure you want to delete this ingredient? Products linked to it will no longer deduct stock.')) return;
        try {
            await deleteInventoryItem(id, restaurantId || '');
            loadData();
        } catch (e) {
            console.error(e);
        }
    }

    const filtered = items
        .filter(item => {
            if (showLowOnly && item.stock_qty > item.min_stock_qty) return false;
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return item.name.toLowerCase().includes(q) || (item.khmer_name && item.khmer_name.toLowerCase().includes(q));
        })
        .sort((a, b) => (a.stock_qty / (a.min_stock_qty || 1)) - (b.stock_qty / (b.min_stock_qty || 1)));

    const lowStockCount = items.filter(i => i.stock_qty <= i.min_stock_qty).length;
    const outOfStockCount = items.filter(i => i.stock_qty <= 0).length;

    return (
        <div className="animate-fade-in space-y-4 pb-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
                        <BoxesIcon size={20} className="text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="text-base font-black text-[var(--foreground)] leading-none uppercase tracking-tight">
                            Ingredient Inventory
                        </h1>
                        <p className="text-[10px] text-[var(--text-secondary)] mt-1 font-bold">
                            Manage raw materials and stock levels for recipe deduction
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                        <input
                            type="text"
                            placeholder="Search ingredients..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl pl-9 pr-3 py-2 text-sm text-[var(--foreground)] focus:border-emerald-500 outline-none transition-all w-48 font-semibold"
                        />
                    </div>
                    <button
                        onClick={() => { setSelectedItem(null); setIsModalOpen(true); }}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white p-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 font-bold text-xs"
                    >
                        <Plus size={16} strokeWidth={3} />
                        Add New
                    </button>
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-3">
                <div className="pos-card p-4 bg-white/[0.02]">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-1">Total Items</p>
                    <p className="text-2xl font-black text-[var(--foreground)] font-mono">{items.length}</p>
                </div>
                <button 
                    onClick={() => setShowLowOnly(!showLowOnly)}
                    className={`pos-card p-4 text-left transition-all border ${showLowOnly ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/20' : 'bg-white/[0.02] border-amber-500/10'}`}
                >
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-1 flex items-center gap-1.5">
                        <AlertTriangle size={12} />
                        Low Stock
                    </p>
                    <p className="text-2xl font-black text-amber-400 font-mono">{lowStockCount}</p>
                </button>
                <div className="pos-card p-4 bg-white/[0.02] border-red-500/10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-1">Out of Stock</p>
                    <p className="text-2xl font-black text-red-400 font-mono">{outOfStockCount}</p>
                </div>
                <div className="pos-card p-4 bg-white/[0.02] border-emerald-500/10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">Stock Health</p>
                    <p className="text-2xl font-black text-emerald-400 font-mono">
                        {items.length ? Math.round(((items.length - lowStockCount) / items.length) * 100) : 100}%
                    </p>
                </div>
            </div>

            {/* Inventory table */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto container-snap">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/[0.02]">
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border)]">
                                    Ingredient & Unit
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border)] text-center">
                                    Current Stock
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border)] text-center">
                                    Visual Level
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border)] text-center">
                                    Avg Cost
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border)] text-right">
                                    Management
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                            {filtered.map(item => {
                                const isLow = item.stock_qty <= item.min_stock_qty && item.stock_qty > 0;
                                const isOut = item.stock_qty <= 0;
                                const pct = item.stock_pct || 0;
                                
                                return (
                                    <tr key={item.id} className="hover:bg-white/[0.02] group transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shadow-sm ${
                                                    isOut ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                                                    isLow ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                                                    'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                                }`}>
                                                    <Package size={16} />
                                                </div>
                                                <div>
                                                    <p className={`text-sm font-bold text-[var(--foreground)] leading-tight ${lang === 'km' ? 'khmer' : ''}`}>
                                                        {lang === 'km' ? (item.khmer_name || item.name) : item.name}
                                                    </p>
                                                    <p className="text-[10px] text-[var(--text-secondary)] mt-1 font-black uppercase tracking-widest">
                                                        Unit: <span className="text-white/60">{item.unit_label}</span>
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`font-mono font-black text-lg ${
                                                isOut ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-emerald-400'
                                            }`}>
                                                {item.stock_qty.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col items-center gap-1.5 min-w-[120px]">
                                                <div className="w-full h-1.5 bg-white/[0.05] rounded-full overflow-hidden border border-white/5">
                                                    <div 
                                                        className={`h-full transition-all duration-1000 ${
                                                            isOut ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                                                        }`}
                                                        style={{ width: `${Math.min(100, pct)}%` }}
                                                    />
                                                </div>
                                                <span className="text-[10px] font-black font-mono text-white/40 uppercase tracking-tighter">
                                                    {pct.toFixed(0)}% Capacity
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <p className="text-xs font-mono font-bold text-white/60">
                                                ${item.cost_per_unit.toFixed(2)}
                                            </p>
                                            <p className="text-[8px] text-white/30 uppercase font-black">per {item.unit_label}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => { setSelectedItem(item); setIsModalOpen(true); }}
                                                    className="p-2 rounded-lg bg-white/[0.05] hover:bg-emerald-500/20 text-white/40 hover:text-emerald-400 border border-transparent hover:border-emerald-500/30 transition-all"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="p-2 rounded-lg bg-white/[0.05] hover:bg-red-500/20 text-white/40 hover:text-red-400 border border-transparent hover:border-red-500/30 transition-all"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center">
                                        <div className="max-w-[200px] mx-auto opacity-20">
                                            <Package size={48} className="mx-auto mb-4" />
                                            <p className="text-sm font-black uppercase tracking-widest">No Ingredients Found</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <InventoryItemModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={loadData}
                item={selectedItem}
            />
        </div>
    );
}
