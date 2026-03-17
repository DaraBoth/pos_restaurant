'use client';
import { useState, useEffect } from 'react';
import { getProducts, getCategories, deleteProduct, updateStock, Product, Category } from '@/lib/tauri-commands';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatUsd } from '@/lib/currency';
import { Package, Plus, Trash2, Box, Minus, Edit3, Image as ImageIcon, Search } from 'lucide-react';
import ProductModal from '@/components/management/ProductModal';

export default function ProductsManagement() {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
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
        try {
            await updateStock(id, delta);
            const newStock = Math.max(0, currentStock + delta);
            setProducts(products.map(p => p.id === id ? { ...p, stock_quantity: newStock } : p));
        } catch (e) {
            console.error('Failed to update stock', e);
            alert('Failed to update stock');
        }
    }

    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.khmer_name && p.khmer_name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="max-w-7xl mx-auto animate-fade-in space-y-6">
            {/* Header Area */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-[#181a20] p-6 lg:p-8 rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden relative">
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--accent)]/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-[100px] pointer-events-none" />
                
                <div className="flex items-center gap-6 relative z-10">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-[var(--accent)]/10 border border-[var(--accent)]/20 shadow-lg">
                        <Package size={32} className="text-[var(--accent)]" strokeWidth={2} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-white tracking-tight leading-none mb-2">Master Roster</h1>
                        <p className="text-sm font-bold text-[#8a8a99] uppercase tracking-widest opacity-60">
                            Asset Monitoring & Catalog Control
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 relative z-10">
                    <div className="relative">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8a8a99]" />
                        <input 
                            type="text"
                            placeholder="Find an item..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="bg-[#0f1115] border border-white/5 rounded-2xl pl-12 pr-6 py-3 text-sm text-white focus:border-[var(--accent)] outline-none transition-all w-full sm:w-64"
                        />
                    </div>
                    
                    <button
                        onClick={() => { setEditingProduct(null); setIsModalOpen(true); }}
                        className="px-6 py-3 rounded-2xl bg-[var(--accent)] text-black font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-[var(--accent)]/20 hover:scale-105 active:scale-95 transition-all"
                    >
                        <Plus size={18} strokeWidth={3} />
                        Register New
                    </button>
                </div>
            </div>

            {/* Data Grid */}
            <div className="bg-[#181a20] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl relative">
                <div className="overflow-x-auto container-snap">
                    <table className="w-full text-left whitespace-nowrap border-collapse">
                        <thead className="bg-[#0f1115]">
                            <tr>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#8a8a99] border-b border-white/5">Visual</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#8a8a99] border-b border-white/5">Product Details</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#8a8a99] border-b border-white/5">Category</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#8a8a99] border-b border-white/5 text-center">In-Stock</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#8a8a99] border-b border-white/5 text-right">Unit Rate</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#8a8a99] border-b border-white/5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredProducts.map(p => (
                                <tr key={p.id} className="transition-colors hover:bg-white/[0.02] group">
                                    <td className="px-8 py-5">
                                        <div className="w-12 h-12 rounded-xl bg-[#0f1115] border border-white/5 flex items-center justify-center overflow-hidden group-hover:border-[var(--accent)]/30 transition-colors">
                                           <ImageIcon size={20} className="text-[#8a8a99]/40" />
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="flex flex-col">
                                                <div className="font-black text-white text-base tracking-tight">{p.name}</div>
                                                <div className="text-xs font-bold text-[#8a8a99] khmer mt-0.5">{p.khmer_name}</div>
                                            </div>
                                            {p.is_available === 0 && (
                                                <span className="px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 text-[8px] font-black uppercase tracking-tighter border border-red-500/20">Hidden</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl bg-[#0f1115] border border-white/5 text-[#8a8a99]">
                                            <Box size={12} className="text-[var(--accent)]" />
                                            {p.category_name}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 text-center">
                                        <div className="inline-flex items-center gap-3">
                                            <button 
                                                onClick={() => handleStockChange(p.id, p.stock_quantity, -1)}
                                                className="w-6 h-6 rounded-lg bg-[#0f1115] flex items-center justify-center text-[#8a8a99] hover:bg-red-500/20 hover:text-red-400 transition-all border border-white/5 active:scale-90"
                                            >
                                                <Minus size={12} strokeWidth={3} />
                                            </button>
                                            <div className="w-12 text-center">
                                                <span className={`font-mono font-black text-base ${
                                                    p.stock_quantity <= 0 ? 'text-red-500' : 'text-white'
                                                }`}>
                                                    {p.stock_quantity}
                                                </span>
                                            </div>
                                            <button 
                                                onClick={() => handleStockChange(p.id, p.stock_quantity, 1)}
                                                className="w-6 h-6 rounded-lg bg-[#0f1115] flex items-center justify-center text-[#8a8a99] hover:bg-green-500/20 hover:text-green-400 transition-all border border-white/5 active:scale-90"
                                            >
                                                <Plus size={12} strokeWidth={3} />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <div className="font-mono font-black text-lg text-[var(--accent)]">
                                            {formatUsd(p.price_cents)}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => { setEditingProduct(p); setIsModalOpen(true); }}
                                                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-[var(--accent)] hover:text-black text-[#8a8a99] transition-all"
                                                title="Edit Details"
                                            >
                                                <Edit3 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(p.id)}
                                                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-red-500 text-white text-[#8a8a99] transition-all"
                                                title="Drop Product"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <ProductModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={loadData}
                categories={categories}
                product={editingProduct}
            />
        </div>
    );
}
