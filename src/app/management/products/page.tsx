'use client';
import { useState, useEffect } from 'react';
import { getProducts, getCategories, createProduct, deleteProduct, updateStock, Product, Category } from '@/lib/tauri-commands';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatUsd } from '@/lib/currency';
import { Package, Plus, Trash2, Box, Minus } from 'lucide-react';

export default function ProductsManagement() {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const { t, lang } = useLanguage();

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            const [cats, prods] = await Promise.all([getCategories(), getProducts()]);
            setCategories(cats);
            setProducts(prods);
        } catch (e) {
            console.error(e);
        }
    }

    async function handleAddDemo() {
        try {
            if (categories.length === 0) return alert('Needs a category first');
            await createProduct(
                categories[0].id,
                'New Demo Item',
                'មុខម្ហូបថ្មី',
                250
            );
            loadData();
        } catch (e) {
            console.error(e);
            alert(t('error'));
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Are you sure you want to delete this product?')) return;
        try {
            await deleteProduct(id);
            loadData();
        } catch (e) {
            console.error(e);
            alert(t('error'));
        }
    }

    async function handleStockChange(id: string, currentStock: number, delta: number) {
        const newStock = Math.max(0, currentStock + delta);
        try {
            await updateStock(id, newStock);
            // Optimistic update
            setProducts(products.map(p => p.id === id ? { ...p, stock_quantity: newStock } : p));
        } catch (e) {
            console.error('Failed to update stock', e);
            alert('Failed to update stock');
        }
    }

    return (
        <div className="max-w-7xl mx-auto animate-fade-in space-y-6">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-[#181a20] p-6 rounded-2xl border border-white/5 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#3b82f6]/10">
                        <Package size={24} className="text-[#3b82f6]" strokeWidth={2} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-1">Products Roster</h1>
                        <p className="text-sm font-medium text-[var(--text-secondary)]">
                            Manage Pricing, Metadata & Inventory
                        </p>
                    </div>
                </div>

                <div className="flex gap-4">
                    {/* Stats Pill */}
                    <div className="px-5 py-2.5 rounded-xl bg-[#0f1115] border border-white/5 flex items-center gap-4">
                        <div className="text-center">
                            <span className="block text-xl font-bold font-mono text-white leading-none">{products.length}</span>
                            <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Items</span>
                        </div>
                        <div className="w-px h-6 bg-white/10" />
                        <div className="text-center">
                            <span className="block text-xl font-bold font-mono text-[#3b82f6] leading-none">{categories.length}</span>
                            <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Categories</span>
                        </div>
                    </div>

                    <button
                        onClick={handleAddDemo}
                        className="btn-primary px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2"
                    >
                        <Plus size={16} />
                        Add New
                    </button>
                </div>
            </div>

            {/* Data Grid */}
            <div className="bg-[#181a20] border border-white/5 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto container-snap">
                    <table className="w-full text-left whitespace-nowrap">
                        <thead className="bg-[#0f1115]">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] border-b border-white/5">Item (EN/KH)</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] border-b border-white/5">Category</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] border-b border-white/5">Price</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] border-b border-white/5">Stock Level</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] border-b border-white/5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {products.map(p => (
                                <tr key={p.id} className="transition-colors hover:bg-white/[0.02] group">
                                    <td className="px-6 py-4">
                                        <div className="font-semibold text-white text-sm">{p.name}</div>
                                        <div className="text-xs font-medium text-[var(--text-secondary)] mt-0.5 khmer">{p.khmer_name}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-[#0f1115] border border-white/5 text-[var(--text-secondary)]">
                                            <Package size={12} />
                                            {p.category_name}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-mono font-bold text-sm text-[#3b82f6]">
                                        {formatUsd(p.price_cents)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
                                                p.stock_quantity <= 0 
                                                    ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                                                    : p.stock_quantity < 10 
                                                        ? 'bg-orange-500/10 border-orange-500/20 text-orange-400'
                                                        : 'bg-green-500/10 border-green-500/20 text-green-400'
                                            }`}>
                                                <Box size={14} />
                                                <span className="font-mono font-bold text-sm">{p.stock_quantity}</span>
                                            </div>
                                            
                                            {/* Quick Stock Controls */}
                                            <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleStockChange(p.id, p.stock_quantity, 1)} className="w-5 h-5 rounded hover:bg-white/10 flex items-center justify-center text-[var(--text-secondary)] hover:text-white">
                                                    <Plus size={12} />
                                                </button>
                                                <button onClick={() => handleStockChange(p.id, p.stock_quantity, -1)} className="w-5 h-5 rounded hover:bg-white/10 flex items-center justify-center text-[var(--text-secondary)] hover:text-white">
                                                    <Minus size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleDelete(p.id)}
                                            className="w-8 h-8 inline-flex items-center justify-center rounded-lg hover:bg-red-500/10 text-[var(--text-secondary)] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                            title="Delete"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {products.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-8 py-16 text-center">
                                        <Package size={40} className="mx-auto mb-3 text-[var(--text-secondary)] opacity-50" strokeWidth={1.5} />
                                        <p className="text-sm font-semibold text-[var(--text-secondary)]">Datastore empty. Add a product to begin.</p>
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
