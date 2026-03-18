'use client';
import { useState, useEffect } from 'react';
import {
    getProducts, getCategories, Product, Category,
    createOrder as apiCreateOrder, addOrderItem as apiAddOrderItem,
    getOrderItems
} from '@/lib/tauri-commands';
import { useOrder } from '@/contexts/OrderContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatUsd } from '@/lib/currency';
import { Search, Plus, Boxes } from 'lucide-react';

export default function ProductGrid() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [addingId, setAddingId] = useState<string | null>(null);

    const { orderId, tableId, setOrderId, setItems } = useOrder();
    const { user } = useAuth();
    const { t, lang } = useLanguage();

    // Load categories & products when category filter changes
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

    // Cart sync
    useEffect(() => {
        if (!orderId) {
            setItems([]);
            return;
        }
        getOrderItems(orderId)
            .then(items => setItems(items))
            .catch(console.error);
    }, [orderId, setItems]);

    async function handleProductClick(product: Product) {
        if (product.is_available === 0 || product.stock_quantity <= 0) return;
        setAddingId(product.id);
        try {
            let currentOrderId = orderId;
            if (!currentOrderId) {
                const userId = user?.id ?? 'system';
                currentOrderId = await apiCreateOrder(userId, tableId || undefined);
                setOrderId(currentOrderId);
            }
            await apiAddOrderItem(currentOrderId, product.id, 1);
            const updatedItems = await getOrderItems(currentOrderId);
            setItems(updatedItems);
        } catch (e) {
            console.error('Failed to add item:', e);
        } finally {
            setTimeout(() => setAddingId(null), 350);
        }
    }

    const filteredProducts = products.filter(p => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            p.name.toLowerCase().includes(q) ||
            (p.khmer_name && p.khmer_name.toLowerCase().includes(q))
        );
    });

    return (
        <div className="flex flex-col min-h-0 h-full relative bg-[var(--background)]">

            {/* Top Toolbar: Search + Categories */}
            <div className="flex-shrink-0 px-6 pt-20 pb-4 border-b border-[var(--border)] bg-[var(--bg-card)]/80 backdrop-blur-xl z-20">
                {/* Search */}
                <div className="relative mb-5" style={{ maxWidth: '600px' }}>
                    <Search
                        size={20}
                        className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
                    />
                    <input
                        type="text"
                        placeholder={lang === 'km' ? 'ស្វែងរកផលិតផល...' : 'Search for anything...'}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-[var(--background)] border-2 border-[var(--border)] text-[var(--foreground)] pl-14 pr-6 py-4 rounded-[1.5rem] text-lg font-black transition-all focus:border-[var(--accent)] focus:outline-none focus:bg-[var(--bg-elevated)] placeholder:text-[var(--text-secondary)]/40"
                    />
                </div>

                {/* Categories */}
                <div className="flex items-center gap-3 overflow-x-auto pb-2 container-snap">
                    <button
                        onClick={() => setSelectedCategory(null)}
                        className={`whitespace-nowrap px-6 py-3 rounded-full text-sm font-black uppercase tracking-widest transition-all ${
                            selectedCategory === null
                                ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/30'
                                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--bg-card)] border border-[var(--border)]'
                        }`}
                    >
                        {t('allCategories')}
                    </button>
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`whitespace-nowrap px-6 py-3 rounded-full text-sm font-black transition-all ${
                                lang === 'km' ? 'khmer font-bold' : 'uppercase tracking-widest'
                            } ${
                                selectedCategory === cat.id
                                    ? 'bg-[var(--accent-blue)] text-white shadow-lg shadow-[var(--accent-blue)]/30'
                                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--bg-card)] border border-[var(--border)]'
                            }`}
                        >
                            {lang === 'km' ? (cat.khmer_name || cat.name) : cat.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Product Grid Area */}
            <div className="flex-1 overflow-y-auto p-6 container-snap z-10 bg-[var(--background)]">
                {filteredProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 opacity-30">
                        <Boxes size={64} className="text-[var(--text-secondary)]" />
                        <p className="font-space font-bold text-lg text-[var(--foreground)]">
                            {searchQuery ? 'NO RESULTS MATCHING QUERY' : 'CATEGORY IS EMPTY'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                        {filteredProducts.map((product, idx) => {
                            const isAdding = addingId === product.id;
                            const outOfStock = product.stock_quantity <= 0;
                            const unavailable = product.is_available === 0 || outOfStock;

                            return (
                                <button
                                    key={product.id}
                                    onClick={() => handleProductClick(product)}
                                    disabled={unavailable}
                                    className={`bento-card group flex flex-col text-left relative overflow-hidden transition-all ${
                                        unavailable ? 'opacity-40 cursor-not-allowed grayscale' : 'cursor-pointer'
                                    }`}
                                    style={{
                                        animationDelay: `${idx * 20}ms`,
                                        minHeight: '220px',
                                        background: 'var(--bg-card)',
                                        border: isAdding ? '2px solid var(--accent)' : '2px solid var(--border)',
                                        borderRadius: '2.5rem',
                                    }}
                                >
                                    {/* Product Image */}
                                    {product.image_path && (
                                        <div className="absolute inset-0 z-0">
                                            <img 
                                                src={`https://asset.localhost/${product.image_path}`}
                                                alt={product.name}
                                                className="w-full h-full object-cover opacity-10 group-hover:opacity-30 transition-opacity"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/40 to-transparent" />
                                        </div>
                                    )}

                                    {/* Content Container */}
                                    <div className="p-6 flex-1 flex flex-col relative z-20">
                                        <div className="flex justify-between items-start mb-6">
                                            {/* Stock Badge */}
                                            <span className={`text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full ${
                                                outOfStock ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-600'
                                            } border border-current/10`}>
                                                {outOfStock ? 'SOLDOUT' : `${product.stock_quantity} IN STOCK`}
                                            </span>
                                            
                                            {/* Action Icon */}
                                            <div className="w-10 h-10 rounded-2xl bg-[var(--background)] border border-[var(--border)] flex items-center justify-center group-hover:bg-[var(--accent)] group-hover:text-white transition-colors shadow-sm">
                                                <Plus size={18} strokeWidth={3} className={isAdding ? 'scale-125 transition-transform' : ''} />
                                            </div>
                                        </div>

                                        <h3 className={`font-black mt-auto mb-1 flex-1 leading-snug line-clamp-2 ${lang === 'km' ? 'khmer text-lg' : 'text-lg text-[var(--foreground)] tracking-tight'}`}>
                                            {lang === 'km' ? (product.khmer_name || product.name) : product.name}
                                        </h3>
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-4 truncate opacity-60">
                                            {lang === 'km' ? (product.category_khmer || product.category_name) : product.category_name}
                                        </span>

                                        <div className="font-mono text-xl font-black text-[var(--accent)]">
                                            {formatUsd(product.price_cents)}
                                        </div>
                                    </div>

                                    {/* Hover Background Injection */}
                                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[var(--accent)]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none" />

                                    {/* Unavailable Strip */}
                                    {unavailable && (
                                        <div className="absolute inset-0 bg-[var(--background)]/60 z-30 flex items-center justify-center backdrop-blur-sm">
                                            <div className="bg-red-500 text-white font-black uppercase px-6 py-2 rounded-full transform -rotate-12 border-2 border-[var(--background)] shadow-xl text-sm tracking-widest">
                                                {outOfStock ? 'SOLD OUT' : 'UNAVAILABLE'}
                                            </div>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
