'use client';
import { useState, useEffect } from 'react';
import {
    getProducts, getCategories, Product, Category,
    createOrder as apiCreateOrder, addOrderItem as apiAddOrderItem,
    getOrderItems
} from '@/lib/tauri-commands';
import { useOrder } from '@/providers/OrderProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { formatUsd } from '@/lib/currency';
import { Search, ShoppingBag } from 'lucide-react';

// Palette for products without images
const CARD_COLORS = [
    '#1e3a2f','#1e2a3a','#2a1e3a','#3a2a1e','#1e3a3a',
    '#2a3a1e','#3a1e2a','#1e2a2a','#2e1e3a','#1e3a26',
];

export default function ProductGrid() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [addingId, setAddingId] = useState<string | null>(null);

    const { orderId, tableId, setOrderId, setItems } = useOrder();
    const { user } = useAuth();
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

    useEffect(() => {
        if (!orderId) { setItems([]); return; }
        getOrderItems(orderId).then(items => setItems(items)).catch(console.error);
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
            setTimeout(() => setAddingId(null), 300);
        }
    }

    const filteredProducts = products.filter(p => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return p.name.toLowerCase().includes(q) || (p.khmer_name && p.khmer_name.toLowerCase().includes(q));
    });

    return (
        <div className="flex flex-col min-h-0 h-full bg-[#0c1520]">

            {/* Search + Category bar */}
            <div className="flex-shrink-0 px-3 pt-3 pb-2 border-b border-[var(--border)] bg-[var(--bg-card)]">
                {/* Search */}
                <div className="relative mb-2">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                    <input
                        type="text"
                        placeholder={lang === 'km' ? 'ស្វែងរកម្ហូប...' : 'Search menu...'}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl pl-9 pr-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--text-secondary)]/50 outline-none focus:border-[var(--accent-blue)]/60 transition-colors"
                    />
                </div>

                {/* Category pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    <button
                        onClick={() => setSelectedCategory(null)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                            selectedCategory === null
                                ? 'bg-[var(--accent)] text-white'
                                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border)] hover:text-[var(--foreground)]'
                        }`}
                    >
                        {t('allCategories')}
                    </button>
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                lang === 'km' ? 'khmer' : ''
                            } ${
                                selectedCategory === cat.id
                                    ? 'bg-[var(--accent)] text-white'
                                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border)] hover:text-[var(--foreground)]'
                            }`}
                        >
                            {lang === 'km' ? (cat.khmer_name || cat.name) : cat.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Product Grid */}
            <div className="flex-1 overflow-y-auto p-3 no-scrollbar">
                {filteredProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-3 opacity-30">
                        <ShoppingBag size={40} className="text-[var(--text-secondary)]" />
                        <p className="text-sm font-semibold text-[var(--text-secondary)]">
                            {searchQuery ? (lang === 'km' ? 'គ្មានលទ្ធផល' : 'No results') : (lang === 'km' ? 'គ្មានផលិតផល' : 'No products')}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
                        {filteredProducts.map((product, idx) => {
                            const isAdding = addingId === product.id;
                            const outOfStock = product.stock_quantity <= 0;
                            const unavailable = product.is_available === 0 || outOfStock;
                            const cardColor = CARD_COLORS[idx % CARD_COLORS.length];
                            const displayName = lang === 'km' ? (product.khmer_name || product.name) : product.name;

                            return (
                                <button
                                    key={product.id}
                                    onClick={() => handleProductClick(product)}
                                    disabled={unavailable}
                                    title={unavailable ? (outOfStock ? (lang === 'km' ? 'áž¢ážŸáŸ‹ážŸáŸ’ážáž»áž€' : 'Out of stock') : (lang === 'km' ? 'áž˜áž·áž“áž˜áž¶áž“' : 'Unavailable')) : displayName}
                                    className={`group flex flex-col text-left relative overflow-hidden rounded-xl transition-all duration-150 active:scale-95 ${
                                        isAdding ? 'scale-95 ring-2 ring-[var(--accent-green)]' : ''
                                    } ${unavailable ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg hover:-translate-y-0.5 cursor-pointer'}`}
                                    style={{ background: cardColor, border: `1px solid rgba(255,255,255,0.08)` }}
                                >
                                    {/* Image area */}
                                    <div className="relative w-full aspect-square overflow-hidden rounded-xl bg-black/20">
                                        {product.image_path ? (
                                            <img
                                                src={`https://asset.localhost/${product.image_path}`}
                                                alt={displayName}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <span className="text-3xl opacity-50">ðŸ½ï¸</span>
                                            </div>
                                        )}
                                        {/* Out of stock overlay */}
                                        {unavailable && (
                                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                                <span className="text-[10px] font-black text-red-400 uppercase tracking-widest bg-black/60 px-2 py-1 rounded-full">
                                                    {outOfStock ? (lang === 'km' ? 'អស់ស្តុក' : 'Sold Out') : (lang === 'km' ? 'មិនមាន' : 'N/A')}
                                                </span>
                                            </div>
                                        )}
                                        {/* Add indicator on hover */}
                                        {!unavailable && (
                                            <div className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full bg-[var(--accent)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                                                <span className="text-white text-xs font-black leading-none">+</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Info area */}
                                    <div className="p-2">
                                        <p className={`text-xs font-semibold text-white leading-tight line-clamp-2 mb-1 ${lang === 'km' ? 'khmer' : ''}`}>
                                            {displayName}
                                        </p>
                                        <p className="text-xs font-bold text-[var(--accent-green)] font-mono">
                                            {formatUsd(product.price_cents)}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
