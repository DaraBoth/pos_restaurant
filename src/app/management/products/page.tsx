'use client';
import { useState, useEffect } from 'react';
import { 
    getProducts, getCategories, deleteProduct, updateStock, 
    Product, Category, deleteCategory 
} from '@/lib/tauri-commands';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatUsd } from '@/lib/currency';
import { 
    Package, Plus, Trash2, Box, Minus, Edit3, 
    Image as ImageIcon, Search, Layers 
} from 'lucide-react';
import ProductModal from '@/components/management/ProductModal';
import CategoryModal from '@/components/management/CategoryModal';

export default function ProductsManagement() {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'products' | 'categories'>('products');
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

    async function handleDeleteProduct(id: string) {
        if (!confirm('Are you sure you want to delete this product?')) return;
        try {
            await deleteProduct(id);
            loadData();
        } catch (e) {
            console.error(e);
            alert(t('error'));
        }
    }

    async function handleDeleteCategory(id: string) {
        // Safety check: is any product using this category?
        const hasProducts = products.some(p => p.category_id === id);
        if (hasProducts) {
            alert('Cannot delete category: It still contains products. Please move or delete the products first.');
            return;
        }

        if (!confirm('Are you sure you want to delete this category?')) return;
        try {
            await deleteCategory(id);
            loadData();
        } catch (e) {
            console.error(e);
            alert('Failed to delete category');
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
        <div className="max-w-7xl mx-auto animate-fade-in space-y-[var(--space-unit)] pb-10">
            {/* Header Area */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-[var(--bg-card)] p-[var(--space-unit)] rounded-[2.5rem] border border-[var(--border)] shadow-xl overflow-hidden relative">
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--accent)]/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-[100px] pointer-events-none" />
                
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-[var(--accent)] text-black shadow-lg shadow-[var(--accent)]/20">
                            {activeTab === 'products' ? <Package size={32} /> : <Layers size={32} />}
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-[var(--foreground)] tracking-tight leading-none mb-2">Catalog Control</h1>
                            <div className="flex gap-4">
                                <button 
                                    onClick={() => setActiveTab('products')}
                                    className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'products' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] opacity-50 hover:opacity-100'}`}
                                >
                                    Products
                                </button>
                                <button 
                                    onClick={() => setActiveTab('categories')}
                                    className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'categories' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] opacity-50 hover:opacity-100'}`}
                                >
                                    Categories
                                </button>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h1 className="text-[var(--text-3xl)] font-black text-[var(--foreground)] tracking-tight leading-none mb-2">Master Roster</h1>
                        <p className="text-[var(--text-xs)] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em] opacity-60">
                            Asset Monitoring & Catalog Control
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                    <div className="relative">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-40" />
                        <input 
                            type="text"
                            placeholder={activeTab === 'products' ? "Search items..." : "Search categories..."}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="bg-[var(--background)] border border-[var(--border)] rounded-2xl pl-12 pr-6 py-4 text-sm text-[var(--foreground)] focus:border-[var(--accent)] outline-none transition-all w-full sm:w-64 font-bold"
                        />
                    </div>
                    
                    <button
                        onClick={() => {
                            if (activeTab === 'products') {
                                setEditingProduct(null);
                                setIsProductModalOpen(true);
                            } else {
                                setEditingCategory(null);
                                setIsCategoryModalOpen(true);
                            }
                        }}
                        className="px-6 py-3.5 rounded-[1.25rem] bg-[var(--accent)] text-white font-black text-[var(--text-sm)] flex items-center justify-center gap-2 shadow-xl shadow-[var(--accent)]/30 hover:scale-105 active:scale-95 transition-all uppercase tracking-widest"
                    >
                        <Plus size={18} strokeWidth={3} />
                        Register New
                    </button>
                </div>
            </div>

            {/* Data Grid */}
            {activeTab === 'products' ? (
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[2.5rem] overflow-hidden shadow-xl relative">
                    <div className="overflow-x-auto container-snap">
                        <table className="w-full text-left whitespace-nowrap border-collapse">
                            <thead className="bg-[var(--bg-elevated)]">
                                <tr>
                                    <th className="px-[var(--space-unit)] py-5 text-[var(--text-xs)] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] border-b border-[var(--border)] opacity-60">Visual</th>
                                    <th className="px-[var(--space-unit)] py-5 text-[var(--text-xs)] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] border-b border-[var(--border)] opacity-60">Product Details</th>
                                    <th className="px-[var(--space-unit)] py-5 text-[var(--text-xs)] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] border-b border-[var(--border)] opacity-60">Category</th>
                                    <th className="px-[var(--space-unit)] py-5 text-[var(--text-xs)] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] border-b border-[var(--border)] text-center opacity-60">In-Stock</th>
                                    <th className="px-[var(--space-unit)] py-5 text-[var(--text-xs)] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] border-b border-[var(--border)] text-right opacity-60">Unit Rate</th>
                                    <th className="px-[var(--space-unit)] py-5 text-[var(--text-xs)] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] border-b border-[var(--border)] text-right opacity-60">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                                {filteredProducts.map(p => (
                                    <tr key={p.id} className="transition-colors hover:bg-[var(--accent)]/5 group">
                                        <td className="px-8 py-5">
                                            <div className="w-12 h-12 rounded-xl bg-[var(--background)] border border-[var(--border)] flex items-center justify-center overflow-hidden group-hover:border-[var(--accent)]/30 transition-colors">
                                               <ImageIcon size={20} className="text-[var(--text-secondary)]/40" />
                                            </div>
                                        </td>
                                        <td className="px-[var(--space-unit)] py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="flex flex-col">
                                                    <div className="font-black text-[var(--foreground)] text-[var(--text-base)] tracking-tight leading-none">{p.name}</div>
                                                    <div className="text-[var(--text-xs)] font-bold text-[var(--text-secondary)] khmer mt-1.5 opacity-60">{p.khmer_name}</div>
                                                </div>
                                                {p.is_available === 0 && (
                                                    <span className="px-2 py-0.5 rounded-md bg-red-500/10 text-red-500 text-[8px] font-black uppercase tracking-tighter border border-red-500/20">Hidden</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-[var(--space-unit)] py-5">
                                            <span className="inline-flex items-center gap-2 text-[var(--text-xs)] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl bg-[var(--background)] border border-[var(--border)] text-[var(--text-secondary)] opacity-80">
                                                <Box size={12} className="text-[var(--accent)]" />
                                                {p.category_name}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <div className="inline-flex items-center gap-3">
                                                <button 
                                                    onClick={() => handleStockChange(p.id, p.stock_quantity, -1)}
                                                    className="w-8 h-8 rounded-lg bg-[var(--background)] flex items-center justify-center text-[var(--text-secondary)] hover:bg-red-500/10 hover:text-red-500 transition-all border border-[var(--border)] active:scale-90"
                                                >
                                                    <Minus size={14} strokeWidth={3} />
                                                </button>
                                                <div className="w-12 text-center">
                                                    <span className={`font-mono font-black text-base ${
                                                        p.stock_quantity <= 0 ? 'text-red-500' : 'text-[var(--foreground)]'
                                                    }`}>
                                                        {p.stock_quantity}
                                                    </span>
                                                </div>
                                                <button 
                                                    onClick={() => handleStockChange(p.id, p.stock_quantity, 1)}
                                                    className="w-8 h-8 rounded-lg bg-[var(--background)] flex items-center justify-center text-[var(--text-secondary)] hover:bg-green-500/10 hover:text-green-600 transition-all border border-[var(--border)] active:scale-90"
                                                >
                                                    <Plus size={14} strokeWidth={3} />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-[var(--space-unit)] py-5 text-right">
                                            <div className="font-mono font-black text-[var(--text-lg)] text-[var(--accent)]">
                                                {formatUsd(p.price_cents)}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => { setEditingProduct(p); setIsProductModalOpen(true); }}
                                                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--background)] border border-[var(--border)] hover:bg-[var(--accent)] hover:text-white text-[var(--text-secondary)] transition-all"
                                                    title="Edit Details"
                                                >
                                                    <Edit3 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteProduct(p.id)}
                                                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--background)] border border-[var(--border)] hover:bg-red-500 hover:text-white text-[var(--text-secondary)] transition-all"
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
            ) : (
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[2.5rem] overflow-hidden shadow-xl relative">
                    <div className="overflow-x-auto container-snap">
                        <table className="w-full text-left whitespace-nowrap border-collapse">
                            <thead className="bg-[var(--bg-elevated)]">
                                <tr>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] border-b border-[var(--border)]">Category Name</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] border-b border-[var(--border)]">Products Count</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] border-b border-[var(--border)] text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                                {categories.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).map(c => (
                                    <tr key={c.id} className="transition-colors hover:bg-[var(--accent)]/5 group">
                                        <td className="px-8 py-5">
                                            <div className="flex flex-col">
                                                <div className="font-black text-[var(--foreground)] text-base tracking-tight">{c.name}</div>
                                                <div className="text-xs font-bold text-[var(--text-secondary)] khmer mt-0.5">{c.khmer_name}</div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="text-sm font-bold text-[var(--text-secondary)]">
                                                {products.filter(p => p.category_id === c.id).length} items
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => { setEditingCategory(c); setIsCategoryModalOpen(true); }}
                                                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--background)] border border-[var(--border)] hover:bg-[var(--accent)] hover:text-white text-[var(--text-secondary)] transition-all"
                                                    title="Edit Details"
                                                >
                                                    <Edit3 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteCategory(c.id)}
                                                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--background)] border border-[var(--border)] hover:bg-red-500 hover:text-white text-[var(--text-secondary)] transition-all"
                                                    title="Drop Category"
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
            )}

            <ProductModal 
                isOpen={isProductModalOpen}
                onClose={() => setIsProductModalOpen(false)}
                onSave={loadData}
                categories={categories}
                product={editingProduct}
            />

            <CategoryModal
                isOpen={isCategoryModalOpen}
                onClose={() => setIsCategoryModalOpen(false)}
                onSave={loadData}
                category={editingCategory}
            />
        </div>
    );
}
