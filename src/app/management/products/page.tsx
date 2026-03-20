'use client';
import { useState, useEffect } from 'react';
import { 
    getProducts, getCategories, deleteProduct, updateStock, 
    Product, Category, deleteCategory 
} from '@/lib/tauri-commands';
import { useLanguage } from '@/providers/LanguageProvider';
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
        <div className="animate-fade-in space-y-3 pb-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[var(--accent)]/15 border border-[var(--accent)]/30">
                        {activeTab === 'products' ? <Package size={14} className="text-[var(--accent)]" /> : <Layers size={14} className="text-[var(--accent)]" />}
                    </div>
                    <div>
                        <h1 className="text-sm font-black text-[var(--foreground)] leading-none">
                            {activeTab === 'products' ? t('products') : t('category')}
                        </h1>
                        <div className="flex gap-3 mt-1">
                            <button
                                onClick={() => setActiveTab('products')}
                                className={`text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'products' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--foreground)]'}`}
                            >
                                {t('products')}
                            </button>
                            <button
                                onClick={() => setActiveTab('categories')}
                                className={`text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'categories' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--foreground)]'}`}
                            >
                                {t('category')}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                        <input
                            type="text"
                            placeholder={t('searchItems')}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="bg-white/[0.07] border border-white/20 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:border-[var(--accent)] outline-none transition-all w-44"
                        />
                    </div>
                    <button
                        onClick={() => {
                            if (activeTab === 'products') { setEditingProduct(null); setIsProductModalOpen(true); }
                            else { setEditingCategory(null); setIsCategoryModalOpen(true); }
                        }}
                        className="pos-btn-primary px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 flex-shrink-0"
                    >
                        <Plus size={13} strokeWidth={2.5} />
                        {activeTab === 'products' ? t('newProduct') : t('newCategory')}
                    </button>
                </div>
            </div>

            {/* Products table */}
            {activeTab === 'products' ? (
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[var(--bg-elevated)]">
                                    <th className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border)] w-12">Visual</th>
                                    <th className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border)]">Product</th>
                                    <th className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border)]">Category</th>
                                    <th className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border)] text-center">Stock</th>
                                    <th className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border)] text-right">Price</th>
                                    <th className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border)] text-right w-20">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                                {filteredProducts.map(p => (
                                    <tr key={p.id} className="hover:bg-white/[0.03] group transition-colors">
                                        {/* Image */}
                                        <td className="px-4 py-2.5">
                                            <div className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center overflow-hidden">
                                                <ImageIcon size={15} className="text-white/20" />
                                            </div>
                                        </td>
                                        {/* Name */}
                                        <td className="px-4 py-2.5">
                                            <div className="font-semibold text-sm text-white leading-tight">{p.name}</div>
                                            {p.khmer_name && <div className="text-xs text-[var(--text-secondary)] khmer mt-0.5">{p.khmer_name}</div>}
                                            {p.is_available === 0 && (
                                                <span className="mt-1 inline-block px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 text-[9px] font-bold uppercase tracking-wider border border-red-500/20">Hidden</span>
                                            )}
                                        </td>
                                        {/* Category */}
                                        <td className="px-4 py-2.5">
                                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/10 text-[var(--text-secondary)]">
                                                <Box size={10} className="text-[var(--accent)]" />
                                                {p.category_name}
                                            </span>
                                        </td>
                                        {/* Stock */}
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => handleStockChange(p.id, p.stock_quantity, -1)}
                                                    className="w-6 h-6 rounded-md bg-white/[0.05] border border-white/10 flex items-center justify-center text-white/50 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-all active:scale-90"
                                                >
                                                    <Minus size={11} strokeWidth={3} />
                                                </button>
                                                <span className={`w-9 text-center font-mono font-bold text-sm ${p.stock_quantity <= 0 ? 'text-red-400' : 'text-white'}`}>
                                                    {p.stock_quantity}
                                                </span>
                                                <button
                                                    onClick={() => handleStockChange(p.id, p.stock_quantity, 1)}
                                                    className="w-6 h-6 rounded-md bg-white/[0.05] border border-white/10 flex items-center justify-center text-white/50 hover:bg-green-500/20 hover:text-green-400 hover:border-green-500/30 transition-all active:scale-90"
                                                >
                                                    <Plus size={11} strokeWidth={3} />
                                                </button>
                                            </div>
                                        </td>
                                        {/* Price */}
                                        <td className="px-4 py-2.5 text-right">
                                            <span className="font-mono font-bold text-sm text-[var(--accent)]">{formatUsd(p.price_cents)}</span>
                                        </td>
                                        {/* Actions */}
                                        <td className="px-4 py-2.5 text-right">
                                            <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => { setEditingProduct(p); setIsProductModalOpen(true); }}
                                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.05] border border-white/10 hover:bg-[var(--accent)] hover:border-[var(--accent)] hover:text-white text-white/50 transition-all"
                                                >
                                                    <Edit3 size={13} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteProduct(p.id)}
                                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.05] border border-white/10 hover:bg-red-500 hover:border-red-500 hover:text-white text-white/50 transition-all"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredProducts.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-10 text-center text-sm text-[var(--text-secondary)]">
                                            {t('noProducts')}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[var(--bg-elevated)]">
                                    <th className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border)]">Category Name</th>
                                    <th className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border)]">Products</th>
                                    <th className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border)] text-right w-20">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                                {categories.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).map(c => (
                                    <tr key={c.id} className="hover:bg-white/[0.03] group transition-colors">
                                        <td className="px-4 py-2.5">
                                            <div className="font-semibold text-sm text-white leading-tight">{c.name}</div>
                                            {c.khmer_name && <div className="text-xs text-[var(--text-secondary)] khmer mt-0.5">{c.khmer_name}</div>}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className="text-xs font-bold text-[var(--text-secondary)]">
                                                {products.filter(p => p.category_id === c.id).length} items
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-right">
                                            <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => { setEditingCategory(c); setIsCategoryModalOpen(true); }}
                                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.05] border border-white/10 hover:bg-[var(--accent)] hover:border-[var(--accent)] hover:text-white text-white/50 transition-all"
                                                >
                                                    <Edit3 size={13} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteCategory(c.id)}
                                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.05] border border-white/10 hover:bg-red-500 hover:border-red-500 hover:text-white text-white/50 transition-all"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {categories.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-4 py-10 text-center text-sm text-[var(--text-secondary)]">
                                            {t('noProducts')}
                                        </td>
                                    </tr>
                                )}
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
