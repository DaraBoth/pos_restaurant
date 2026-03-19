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
        <div className="animate-fade-in space-y-4 pb-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[var(--accent)]/15 border border-[var(--accent)]/30">
                        {activeTab === 'products' ? <Package size={16} className="text-[var(--accent)]" /> : <Layers size={16} className="text-[var(--accent)]" />}
                    </div>
                    <div>
                        <h1 className="text-base font-black text-[var(--foreground)] leading-none">
                            {lang === 'km' ? 'ហាងកាហ្វេ' : activeTab === 'products' ? 'Products' : 'Categories'}
                        </h1>
                        <div className="flex gap-3 mt-1">
                            <button
                                onClick={() => setActiveTab('products')}
                                className={`text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'products' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--foreground)]'}`}
                            >
                                {lang === 'km' ? 'ផលិតផល' : 'Products'}
                                </button>
                                <button
                                onClick={() => setActiveTab('categories')}
                                className={`text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'categories' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--foreground)]'}`}
                            >
                                {lang === 'km' ? 'ប្រភេទ' : 'Categories'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                        <input
                            type="text"
                            placeholder={activeTab === 'products' ? (lang === 'km' ? 'ស្វែងរក...' : 'Search items...') : (lang === 'km' ? 'ស្វែងរក...' : 'Search categories...')}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl pl-9 pr-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent)] outline-none transition-all w-52"
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
                        className="pos-btn-primary px-4 py-2 text-xs uppercase tracking-widest flex items-center gap-1.5 flex-shrink-0"
                    >
                        <Plus size={14} strokeWidth={2.5} />
                        {lang === 'km' ? 'បន្ថែម' : activeTab === 'products' ? 'New Product' : 'New Category'}
                    </button>
                </div>
            </div>

            {/* Data Grid */}
            {activeTab === 'products' ? (
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
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
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
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
