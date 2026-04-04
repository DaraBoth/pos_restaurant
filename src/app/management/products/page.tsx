'use client';
import { useState, useEffect } from 'react';
import { 
    getProducts, getCategories, deleteProduct, 
    deleteCategory 
} from '@/lib/api/products';
import { useAuth } from '@/providers/AuthProvider';
import type { Product, Category } from '@/types';
import { useLanguage } from '@/providers/LanguageProvider';
import { formatUsd } from '@/lib/currency';
import { 
    Package, Plus, Trash2, Box, Minus, Edit3, 
    Image as ImageIcon, Search, Layers 
} from 'lucide-react';
import ProductModal from '@/components/management/ProductModal';
import CategoryModal from '@/components/management/CategoryModal';
import { getImageSrc } from '@/lib/image';

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
    const { user } = useAuth();
    const restaurantId = user?.restaurant_id;

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        if (!restaurantId) return;
        try {
            const [cats, prods] = await Promise.all([
                getCategories(restaurantId), 
                getProducts(undefined, restaurantId)
            ]);
            setCategories(cats);
            setProducts(prods);
        } catch (e) {
            console.error(e);
        }
    }

    async function handleDeleteProduct(id: string) {
        if (!confirm('Are you sure you want to delete this product?')) return;
        try {
            await deleteProduct(id, restaurantId || '');
            loadData();
        } catch (e) {
            console.error(e);
            alert(t('error'));
        }
    }

    async function handleDeleteCategory(id: string) {
        // Recursively gather this category and all its descendants
        const getDescendantIds = (catId: string): string[] => {
            const children = categories.filter(c => c.parent_id === catId);
            return [catId, ...children.flatMap(c => getDescendantIds(c.id))];
        };
        const allIds = getDescendantIds(id);
        const hasProducts = products.some(p => allIds.includes(p.category_id || ''));
        if (hasProducts) {
            alert('Cannot delete: this category or one of its sub-categories still contains products. Please move or delete them first.');
            return;
        }
        const hasChildren = categories.some(c => c.parent_id === id);
        if (hasChildren) {
            alert('Cannot delete: this category still has sub-categories. Please delete or reassign them first.');
            return;
        }

        if (!confirm('Are you sure you want to delete this category?')) return;
        try {
            await deleteCategory(id, restaurantId || '');
            loadData();
        } catch (e) {
            console.error(e);
            alert('Failed to delete category');
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
                            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[var(--foreground)] placeholder:text-[var(--text-secondary)] outline-none focus:border-[var(--accent)] transition-colors w-44"
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
                                                {getImageSrc(p.image_path) ? (
                                                    <img 
                                                        src={getImageSrc(p.image_path)!} 
                                                        alt={p.name} 
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <ImageIcon size={15} className="text-white/20" />
                                                )}
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
                                    <tr key={c.id} className="hover:bg-[var(--bg-elevated)] group transition-colors">
                                        <td className="py-2.5" style={{ paddingLeft: `${16 + (c.depth || 0) * 20}px`, paddingRight: '16px' }}>
                                            <div className="flex items-center gap-1.5">
                                                {(c.depth || 0) > 0 && <span className="text-[var(--text-secondary)] text-xs select-none">└</span>}
                                                <div>
                                                    <div className="font-semibold text-sm text-[var(--foreground)] leading-tight">{c.name}</div>
                                                    {c.khmer_name && <div className="text-xs text-[var(--text-secondary)] khmer mt-0.5">{c.khmer_name}</div>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className="text-xs font-bold text-[var(--text-secondary)]">
                                                {products.filter(p => p.category_id === c.id).length} items
                                                {categories.some(sub => sub.parent_id === c.id) && (
                                                    <span className="ml-2 text-[var(--accent)] opacity-70">
                                                        · {categories.filter(sub => sub.parent_id === c.id).length} sub-cats
                                                    </span>
                                                )}
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
                allCategories={categories}
            />
        </div>
    );
}
