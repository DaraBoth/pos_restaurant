'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/providers/LanguageProvider';
import { getInventoryItems, deleteInventoryItem, receiveStock } from '@/lib/api/inventory';
import { useAuth } from '@/providers/AuthProvider';
import {
    BoxesIcon, Search, AlertTriangle,
    Plus, Package, Trash2, Edit2,
    ArrowUpRight, X
} from 'lucide-react';
import InventoryItemModal from '@/components/management/InventoryItemModal';
import { InventoryItem } from '@/types';
import { canDelete } from '@/lib/permissions';

export default function InventoryView() {
    const { t, lang } = useLanguage();
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showLowOnly, setShowLowOnly] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [stockInItemId, setStockInItemId] = useState<string | null>(null);
    const [stockInQty, setStockInQty] = useState('');
    const [stockInNote, setStockInNote] = useState('');
    const [stockInLoading, setStockInLoading] = useState(false);
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
        if (!canDelete(user?.role) || !user?.id) return;
        setDeleteConfirmId(id);
    }

    async function confirmDelete() {
        if (!deleteConfirmId || !user?.id) return;
        const id = deleteConfirmId;
        setDeleteConfirmId(null);
        try {
            await deleteInventoryItem(id, restaurantId || '', user.id);
            loadData();
        } catch (e) {
            console.error(e);
        }
    }

    async function handleStockIn() {
        if (!stockInItemId || !user?.id || !restaurantId) return;
        const qty = parseFloat(stockInQty);
        if (isNaN(qty) || qty <= 0) return;
        setStockInLoading(true);
        try {
            const updated = await receiveStock(stockInItemId, qty, stockInNote.trim() || undefined, user.id, restaurantId);
            setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
            setStockInItemId(null);
            setStockInQty('');
            setStockInNote('');
        } catch (e) {
            console.error(e);
        } finally {
            setStockInLoading(false);
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
                        <BoxesIcon size={20} className="text-emerald-600" />
                    </div>
                    <div>
                        <h1 className="text-base font-black text-[var(--foreground)] leading-none uppercase tracking-tight">
                            {t('stockInventoryTitle')}
                        </h1>
                        <p className="text-[10px] text-[var(--text-secondary)] mt-1 font-bold">
                            {t('stockInventoryDesc')}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                        <input
                            type="text"
                            placeholder={t('searchStockItems') ?? 'Search stock items...'}
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
                        {t('addNew')}
                    </button>
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-3">
                <div className="pos-card p-4 bg-[var(--bg-card)]">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-1">{t('totalItems')}</p>
                    <p className="text-2xl font-black text-[var(--foreground)] font-mono">{items.length}</p>
                </div>
                <button 
                    onClick={() => setShowLowOnly(!showLowOnly)}
                    className={`pos-card p-4 text-left transition-all border ${showLowOnly ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/20' : 'bg-[var(--bg-card)] border-amber-500/10'}`}
                >
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1 flex items-center gap-1.5">
                        <AlertTriangle size={12} />
                        {t('lowStock')}
                    </p>
                    <p className="text-2xl font-black text-amber-600 font-mono">{lowStockCount}</p>
                </button>
                <div className="pos-card p-4 bg-[var(--bg-card)] border-red-500/10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-1">{t('outOfStockLabel')}</p>
                    <p className="text-2xl font-black text-red-500 font-mono">{outOfStockCount}</p>
                </div>
                <div className="pos-card p-4 bg-[var(--bg-card)] border-emerald-500/10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">{t('stockHealth')}</p>
                    <p className="text-2xl font-black text-emerald-600 font-mono">
                        {items.length ? Math.round(((items.length - lowStockCount) / items.length) * 100) : 100}%
                    </p>
                </div>
            </div>

            {/* Inventory table */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto container-snap">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[var(--bg-elevated)]">
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border)]">
                                    {t('stockAndUnit')}
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border)] text-center">
                                    {t('currentStock')}
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border)] text-center">
                                    {t('visualLevel')}
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border)] text-center">
                                    {t('avgCost')}
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border)] text-right">
                                    {t('manageColumn')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                            {filtered.map(item => {
                                const isLow = item.stock_qty <= item.min_stock_qty && item.stock_qty > 0;
                                const isOut = item.stock_qty <= 0;
                                const pct = item.stock_pct || 0;
                                
                                return (
                                    <tr key={item.id} className="hover:bg-[var(--bg-elevated)] group transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shadow-sm ${
                                                    isOut ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                                                    isLow ? 'bg-amber-500/10 border-amber-500/20 text-amber-600' :
                                                    'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                                                }`}>
                                                    <Package size={16} />
                                                </div>
                                                <div>
                                                    <p className={`text-sm font-bold text-[var(--foreground)] leading-tight ${lang === 'km' ? 'khmer' : ''}`}>
                                                        {lang === 'km' ? (item.khmer_name || item.name) : item.name}
                                                    </p>
                                                    <p className="text-[10px] text-[var(--text-secondary)] mt-1 font-black uppercase tracking-widest">
                                                        Unit: <span className="text-[var(--foreground)]/60">{item.unit_label}</span>
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`font-mono font-black text-lg ${
                                                isOut ? 'text-red-500' : isLow ? 'text-amber-600' : 'text-emerald-600'
                                            }`}>
                                                {item.stock_qty.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col items-center gap-1.5 min-w-[120px]">
                                                <div className="w-full h-1.5 bg-[var(--bg-dark)] rounded-full overflow-hidden border border-[var(--border)]">
                                                    <div 
                                                        className={`h-full transition-all duration-1000 ${
                                                            isOut ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                                                        }`}
                                                        style={{ width: `${Math.min(100, pct)}%` }}
                                                    />
                                                </div>
                                                <span className="text-[10px] font-black font-mono text-[var(--text-secondary)] uppercase tracking-tighter opacity-70">
                                                    {pct.toFixed(0)}% Capacity
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <p className="text-xs font-mono font-bold text-[var(--foreground)]/70">
                                                ${item.cost_per_unit.toFixed(2)}
                                            </p>
                                            <p className="text-[8px] text-[var(--text-secondary)] uppercase font-black opacity-70">per {item.unit_label}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => { setStockInItemId(item.id); setStockInQty(''); setStockInNote(''); }}
                                                    className="px-2.5 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/20 hover:border-emerald-500/40 transition-all flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider"
                                                >
                                                    <ArrowUpRight size={14} strokeWidth={2.5} />
                                                    {t('stockIn')}
                                                </button>
                                                <button
                                                    onClick={() => { setSelectedItem(item); setIsModalOpen(true); }}
                                                    className="p-2 rounded-lg bg-[var(--bg-elevated)] hover:bg-emerald-500/20 text-[var(--text-secondary)] hover:text-emerald-600 border border-transparent hover:border-emerald-500/30 transition-all"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                {canDelete(user?.role) && (
                                                    <button
                                                        onClick={() => handleDelete(item.id)}
                                                        className="p-2 rounded-lg bg-[var(--bg-elevated)] hover:bg-red-500/20 text-[var(--text-secondary)] hover:text-red-500 border border-transparent hover:border-red-500/30 transition-all"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
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
                                            <p className="text-sm font-black uppercase tracking-widest">{t('noStockItemsFound')}</p>
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

            {deleteConfirmId && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl w-80 p-6 mx-4 space-y-4">
                        <h3 className="text-sm font-black text-red-400 uppercase tracking-widest">{t('deleteMaterial')}</h3>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{t('deleteStockItemConfirm')}</p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-all"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest bg-red-500 text-white hover:bg-red-600 transition-all"
                            >
                                {t('delete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {stockInItemId && (() => {
                const target = items.find(i => i.id === stockInItemId);
                return (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => !stockInLoading && setStockInItemId(null)}>
                        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl w-96 max-w-[90vw] mx-4" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20 text-emerald-600">
                                        <ArrowUpRight size={16} strokeWidth={2.5} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-[var(--foreground)] uppercase tracking-wide leading-none">{t('receiveStock')}</h3>
                                        {target && (
                                            <p className="text-[11px] text-[var(--text-secondary)] mt-1 font-semibold">
                                                {lang === 'km' ? (target.khmer_name || target.name) : target.name}
                                                <span className="opacity-60"> · {target.stock_qty.toLocaleString()} {target.unit_label}</span>
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <button onClick={() => !stockInLoading && setStockInItemId(null)} className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--bg-elevated)] transition-all">
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">{t('quantityReceived')}</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        autoFocus
                                        value={stockInQty}
                                        onChange={e => setStockInQty(e.target.value)}
                                        className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--foreground)] font-mono font-bold focus:border-emerald-500 outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">{t('note')} ({t('optional')})</label>
                                    <input
                                        type="text"
                                        value={stockInNote}
                                        onChange={e => setStockInNote(e.target.value)}
                                        className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--foreground)] font-semibold placeholder:text-[var(--text-secondary)]/50 focus:border-emerald-500 outline-none transition-all"
                                    />
                                </div>
                                <div className="flex gap-2 pt-1">
                                    <button
                                        onClick={() => setStockInItemId(null)}
                                        disabled={stockInLoading}
                                        className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-all disabled:opacity-50"
                                    >
                                        {t('cancel')}
                                    </button>
                                    <button
                                        onClick={handleStockIn}
                                        disabled={stockInLoading || !(parseFloat(stockInQty) > 0)}
                                        className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest bg-emerald-500 text-white hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {stockInLoading ? (
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <ArrowUpRight size={14} strokeWidth={2.5} />
                                        )}
                                        {t('confirm')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
