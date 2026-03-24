'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/providers/LanguageProvider';
import { getProducts, getCategories, updateStock, Product, Category } from '@/lib/tauri-commands';
import { useAuth } from '@/providers/AuthProvider';
import { BoxesIcon, Search, AlertTriangle, Minus, Plus, Package } from 'lucide-react';

const LOW_STOCK_THRESHOLD = 10;

export default function InventoryView() {
    const { t, lang } = useLanguage();
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showLowOnly, setShowLowOnly] = useState(false);
    const { user } = useAuth();
    const restaurantId = user?.restaurant_id;

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        if (!restaurantId) return;
        try {
            const [prods, cats] = await Promise.all([
                getProducts(undefined, restaurantId),
                getCategories(restaurantId)
            ]);
            setProducts(prods);
            setCategories(cats);
        } catch (e) {
            console.error(e);
        }
    }

    async function handleStockChange(id: string, currentStock: number, delta: number) {
        try {
            await updateStock(id, delta, restaurantId || '');
            setProducts(prev =>
                prev.map(p => p.id === id ? { ...p, stock_quantity: Math.max(0, p.stock_quantity + delta) } : p)
            );
        } catch (e) {
            console.error('Failed to update stock', e);
        }
    }

    const filtered = products
        .filter(p => {
            if (showLowOnly && p.stock_quantity > LOW_STOCK_THRESHOLD) return false;
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return p.name.toLowerCase().includes(q) || (p.khmer_name && p.khmer_name.toLowerCase().includes(q));
        })
        .sort((a, b) => a.stock_quantity - b.stock_quantity); // lowest stock first

    const lowStockCount = products.filter(p => p.stock_quantity <= LOW_STOCK_THRESHOLD).length;
    const outOfStockCount = products.filter(p => p.stock_quantity <= 0).length;

    const getCategoryName = (catId: string) =>
        categories.find(c => c.id === catId)?.name || '—';

    return (
        <div className="animate-fade-in space-y-4 pb-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-amber-500/15 border border-amber-500/30">
                        <BoxesIcon size={16} className="text-amber-400" strokeWidth={2} />
                    </div>
                    <div>
                        <h1 className="text-base font-black text-[var(--foreground)] leading-none">
                            {t('inventoryAudit')}
                        </h1>
                        <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                            {t('inventoryDesc')}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                        <input
                            type="text"
                            placeholder={t('searchItems')}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl pl-9 pr-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent-blue)] outline-none transition-all w-48"
                        />
                    </div>
                    <button
                        onClick={() => setShowLowOnly(!showLowOnly)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
                            showLowOnly
                                ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                                : 'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)]'
                        }`}
                    >
                        <AlertTriangle size={13} />
                        {t('lowStock')} ({lowStockCount})
                    </button>
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
                <div className="pos-card p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">{t('products')}</p>
                    <p className="text-xl font-black text-[var(--foreground)] font-mono">{products.length}</p>
                </div>
                <div className="pos-card p-3 border-amber-500/20">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400 mb-1">{t('lowStock')}</p>
                    <p className="text-xl font-black text-amber-400 font-mono">{lowStockCount}</p>
                </div>
                <div className="pos-card p-3 border-red-500/20">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-1">{t('outOfStock')}</p>
                    <p className="text-xl font-black text-red-400 font-mono">{outOfStockCount}</p>
                </div>
            </div>

            {/* Inventory table */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[var(--bg-elevated)]">
                                <th className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border)]">
                                    {t('productName')}
                                </th>
                                <th className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border)]">
                                    {t('category')}
                                </th>
                                <th className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border)] text-center">
                                    {t('stockLevel')}
                                </th>
                                <th className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border)] text-center">
                                    {t('statusCol')}
                                </th>
                                <th className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border)] text-center w-36">
                                    {t('actionsCol')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                            {filtered.map(p => {
                                const isLow = p.stock_quantity <= LOW_STOCK_THRESHOLD && p.stock_quantity > 0;
                                const isOut = p.stock_quantity <= 0;
                                const displayName = lang === 'km' ? (p.khmer_name || p.name) : p.name;
                                const subName = lang === 'km' ? p.name : p.khmer_name;

                                return (
                                    <tr key={p.id} className="hover:bg-white/[0.03] group transition-colors">
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                                                    isOut ? 'bg-red-500/10 border-red-500/20' :
                                                    isLow ? 'bg-amber-500/10 border-amber-500/20' :
                                                    'bg-green-500/10 border-green-500/20'
                                                }`}>
                                                    <Package size={14} className={
                                                        isOut ? 'text-red-400' :
                                                        isLow ? 'text-amber-400' :
                                                        'text-green-400'
                                                    } />
                                                </div>
                                                <div>
                                                    <p className={`text-sm font-semibold text-[var(--foreground)] leading-tight ${lang === 'km' ? 'khmer' : ''}`}>
                                                        {displayName}
                                                    </p>
                                                    {subName && (
                                                        <p className={`text-[10px] text-[var(--text-secondary)] mt-0.5 ${lang !== 'km' ? 'khmer' : ''}`}>
                                                            {subName}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className="text-xs text-[var(--text-secondary)]">
                                                {p.category_id ? getCategoryName(p.category_id) : '—'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center justify-center">
                                                <span className={`font-mono font-bold text-base ${
                                                    isOut ? 'text-red-400' :
                                                    isLow ? 'text-amber-400' :
                                                    'text-green-400'
                                                }`}>
                                                    {p.stock_quantity}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5 text-center">
                                            {isOut ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-wider">
                                                    <AlertTriangle size={10} />
                                                    {t('outOfStock')}
                                                </span>
                                            ) : isLow ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                                                    <AlertTriangle size={10} />
                                                    {t('lowStock')}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-bold uppercase tracking-wider">
                                                    {t('available')}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => handleStockChange(p.id, p.stock_quantity, -1)}
                                                    className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center text-white/50 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-all active:scale-90"
                                                >
                                                    <Minus size={12} strokeWidth={3} />
                                                </button>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={p.stock_quantity}
                                                    onChange={e => {
                                                        const val = parseInt(e.target.value) || 0;
                                                        const delta = val - p.stock_quantity;
                                                        if (delta !== 0) handleStockChange(p.id, p.stock_quantity, delta);
                                                    }}
                                                    className="w-14 text-center bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg py-1 text-sm font-mono font-bold text-[var(--foreground)] outline-none focus:border-[var(--accent-blue)] transition-colors"
                                                />
                                                <button
                                                    onClick={() => handleStockChange(p.id, p.stock_quantity, 1)}
                                                    className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center text-white/50 hover:bg-green-500/20 hover:text-green-400 hover:border-green-500/30 transition-all active:scale-90"
                                                >
                                                    <Plus size={12} strokeWidth={3} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-12 text-center">
                                        <Package size={28} className="mx-auto mb-3 text-[var(--text-secondary)] opacity-20" />
                                        <p className="text-[var(--text-secondary)] font-bold text-xs">{t('noProducts')}</p>
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
