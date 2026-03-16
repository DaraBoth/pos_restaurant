'use client';
import { useState, useEffect } from 'react';
import { getProducts, getCategories, Product, Category, createOrder as apiCreateOrder, addOrderItem as apiAddOrderItem } from '@/lib/tauri-commands';
import { useOrder } from '@/contexts/OrderContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatUsd } from '@/lib/currency';
import { Search } from 'lucide-react';

export default function ProductGrid() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const { orderId, setOrderId } = useOrder();
    const { t, lang } = useLanguage();

    useEffect(() => {
        async function load() {
            try {
                const [cats, prods] = await Promise.all([
                    getCategories(),
                    getProducts(selectedCategory || undefined)
                ]);
                setCategories(cats);
                setProducts(prods);
            } catch (e) {
                console.error(e);
            }
        }
        load();
    }, [selectedCategory]);

    async function handleProductClick(product: Product) {
        try {
            let currentOrderId = orderId;
            if (!currentOrderId) {
                // Auto-start order if none exists (user_id and table_id can be handled later)
                // For now, assigning to a dummy user and no table
                currentOrderId = await apiCreateOrder('rest-00000000-0000-0000-0000-000000000001'); // Temporarily using restaurant ID instead of session user ID just to ensure it works
                setOrderId(currentOrderId);
            }

            if (currentOrderId) {
                await apiAddOrderItem(currentOrderId, product.id, 1);
                // Note: the sidebar should ideally be refreshed with new items. We can just rely on a polling mechanism or callback in the future.
            } else {
                alert(t('error') + ': Please click "New Order" first');
            }
        } catch (e) {
            console.error(e);
        }
    }

    const filteredProducts = products.filter(p => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return p.name.toLowerCase().includes(q) || (p.khmer_name && p.khmer_name.includes(q));
    });

    return (
        <div className="flex flex-col h-full bg-[var(--bg-dark)] px-4">
            {/* Top Bar: Search & Categories */}
            <div className="pt-6 pb-4 space-y-4 shadow-sm z-10 sticky top-0 bg-[var(--bg-dark)]">
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={18} />
                    <input
                        type="text"
                        placeholder="Search products..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input-dark w-full pl-10 pr-4 py-3 rounded-xl text-sm"
                    />
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                    <button
                        onClick={() => setSelectedCategory(null)}
                        className={`whitespace-nowrap px-5 py-2 rounded-full text-sm font-medium transition-all ${selectedCategory === null
                            ? 'bg-[var(--accent)] text-black shadow-md shadow-amber-500/20'
                            : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-white border border-[var(--border)]'
                            }`}
                    >
                        {t('allCategories')}
                    </button>

                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`whitespace-nowrap px-5 py-2 rounded-full text-sm font-medium transition-all ${lang === 'km' ? 'khmer' : ''} ${selectedCategory === cat.id
                                ? 'bg-[var(--accent)] text-black shadow-md shadow-amber-500/20'
                                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-white border border-[var(--border)]'
                                }`}
                        >
                            {lang === 'km' ? (cat.khmer_name || cat.name) : cat.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto pb-24 pt-2">
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                    {filteredProducts.map((product, idx) => (
                        <div
                            key={product.id}
                            onClick={() => handleProductClick(product)}
                            className="product-card glass rounded-2xl p-4 flex flex-col justify-between h-32 animate-fade-in"
                            style={{ animationDelay: `${idx * 20}ms` }}
                        >
                            <div>
                                <h3 className={`font-semibold leading-tight mb-1 text-white line-clamp-2 ${lang === 'km' ? 'khmer text-sm' : 'text-base'}`}>
                                    {lang === 'km' ? (product.khmer_name || product.name) : product.name}
                                </h3>
                                <span className="text-xs text-[var(--text-secondary)] px-2 py-0.5 rounded-md bg-[var(--bg-dark)] border border-[var(--border)]">
                                    {lang === 'km' ? (product.category_khmer || product.category_name) : product.category_name}
                                </span>
                            </div>

                            <div className="flex justify-between items-end mt-2">
                                <span className="text-lg font-bold font-mono text-[var(--accent)]">
                                    {formatUsd(product.price_cents)}
                                </span>
                                <div className="w-8 h-8 rounded-full bg-[var(--bg-dark)] border border-[var(--border)] flex items-center justify-center text-xs opacity-50 group-hover:bg-[var(--accent)] group-hover:text-black group-hover:opacity-100 transition-all">
                                    +
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {filteredProducts.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-64 text-[var(--text-secondary)]">
                        <Search size={48} className="opacity-20 mb-4" />
                        <p>No products found in this category.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
