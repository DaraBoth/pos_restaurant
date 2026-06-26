'use client';
import { useState, useEffect, useRef } from 'react';
import { getProducts, getCategories } from '@/lib/api/products';
import { getOrderItems } from '@/lib/api/orders';
import { useOrder } from '@/providers/OrderProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { formatUsd, formatKhr, roundKhr } from '@/lib/currency';
import { getImageSrc } from '@/lib/image';
import { getTopProducts } from '@/lib/api/analytics';
import type { Product, Category, TopProduct } from '@/types';
import { Search, ShoppingBag, UtensilsCrossed, Flame, Star, Sparkles, AlertTriangle, PlusCircle } from 'lucide-react';
import QuantityModal from './QuantityModal';
import VariantPickerModal from './VariantPickerModal';
import ModifierPickerModal from './ModifierPickerModal';
import type { ProductVariant, ProductModifierOption } from '@/types';

// Palette for products without images
const CARD_COLORS = [
    '#1e3a2f','#1e2a3a','#2a1e3a','#3a2a1e','#1e3a3a',
    '#2a3a1e','#3a1e2a','#1e2a2a','#2e1e3a','#1e3a26',
];

export default function ProductGrid() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [addingId, setAddingId] = useState<string | null>(null);
    const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
    const [soldOutToastId, setSoldOutToastId] = useState<string | null>(null);
    const [qtyModalProduct, setQtyModalProduct] = useState<Product | null>(null);
    const [variantPickerProduct, setVariantPickerProduct] = useState<Product | null>(null);
    const [modifierPickerProduct, setModifierPickerProduct] = useState<Product | null>(null);
    const soldOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const { orderId, tableId, setOrderId, setItems, addToLocalCart, exchangeRate, rateIsDefault } = useOrder();
    const { user, licenseExpiredPending } = useAuth();
    const { t, lang } = useLanguage();

    useEffect(() => {
        async function load() {
            try {
                const [cats, prods, tops] = await Promise.all([
                    getCategories(user?.restaurant_id || undefined),
                    getProducts(undefined, user?.restaurant_id || undefined),
                    getTopProducts('month', user?.restaurant_id || undefined)
                ]);
                setCategories(cats);
                setAllProducts(prods);
                setTopProducts(tops);
            } catch (e) {
                console.error(e);
            }
        }
        load();
    }, [user?.restaurant_id]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!orderId) return;
        getOrderItems(orderId, user?.restaurant_id || '').then(items => setItems(items)).catch(console.error);
    }, [orderId, setItems, user?.restaurant_id]);

    function showSoldOutToast(productId: string) {
        setSoldOutToastId(productId);
        if (soldOutTimerRef.current) clearTimeout(soldOutTimerRef.current);
        soldOutTimerRef.current = setTimeout(() => setSoldOutToastId(null), 1800);
    }

    // Returns true when the product can be added (not blocked); shows the
    // sold-out toast and returns false otherwise.
    function ensureAddable(product: Product): boolean {
        if (licenseExpiredPending) return false;
        if (product.is_available === 0) return false;
        if (product.sold_out_today) {
            showSoldOutToast(product.id);
            return false;
        }
        // Stock-based sold-out gate is intentionally NOT applied here: the legacy
        // products.stock_quantity column is NOT NULL DEFAULT 0, so every product
        // reads as 0 and was wrongly blocked as "sold out". It is re-enabled once
        // the nullable stock_quantity migration (task 3e9cf8ae) + stock UI land.
        return true;
    }

    function hasVariants(product: Product): boolean {
        return !!product.variants && product.variants.some(v => v.is_active !== 0);
    }

    function hasModifiers(product: Product): boolean {
        return !!product.modifier_groups && product.modifier_groups.some(g => g.options.some(o => o.is_active !== 0));
    }

    async function addQuantity(product: Product, qty: number, variant?: ProductVariant, modifiers?: ProductModifierOption[]) {
        if (!ensureAddable(product)) return;
        setAddingId(product.id);
        try {
            await addToLocalCart(product, qty, variant, modifiers);
        } catch (e) {
            console.error('Failed to add item:', e);
        } finally {
            setTimeout(() => setAddingId(null), 300);
        }
    }

    async function handleProductClick(product: Product, e?: React.MouseEvent) {
        if (!ensureAddable(product)) return;
        // Products with variants must be picked before they can be added to the cart.
        if (hasVariants(product)) {
            setVariantPickerProduct(product);
            return;
        }
        // Products with modifier groups open the modifier picker.
        if (hasModifiers(product)) {
            setModifierPickerProduct(product);
            return;
        }
        // Shift+click is a discoverable power-user shortcut for bulk quantity entry.
        if (e?.shiftKey) {
            setQtyModalProduct(product);
            return;
        }
        await addQuantity(product, 1);
    }

    function openQuantityModal(product: Product) {
        if (!ensureAddable(product)) return;
        if (hasVariants(product)) {
            setVariantPickerProduct(product);
            return;
        }
        if (hasModifiers(product)) {
            setModifierPickerProduct(product);
            return;
        }
        setQtyModalProduct(product);
    }

    const filteredProducts = allProducts.filter(p => {
        if (selectedCategory && p.category_id !== selectedCategory) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            if (!p.name.toLowerCase().includes(q) && !(p.khmer_name && p.khmer_name.toLowerCase().includes(q))) return false;
        }
        return true;
    });

    const bestSellerId = topProducts[0]?.id;
    const recommendedId = topProducts[1]?.id;
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const sortedFiltered = [...filteredProducts].sort((a, b) => {
        const isNewA = a.created_at ? (now - new Date(a.created_at).getTime() < SEVEN_DAYS_MS) : false;
        const isNewB = b.created_at ? (now - new Date(b.created_at).getTime() < SEVEN_DAYS_MS) : false;
        
        const rankA = a.id === bestSellerId ? 1 : a.id === recommendedId ? 2 : isNewA ? 3 : 4;
        const rankB = b.id === bestSellerId ? 1 : b.id === recommendedId ? 2 : isNewB ? 3 : 4;
        
        if (rankA !== rankB) return rankA - rankB;
        return a.name.localeCompare(b.name);
    });

    return (
        <div className="flex flex-col min-h-0 h-full bg-[var(--bg-dark)] relative">

            {licenseExpiredPending && (
                <div className="absolute inset-0 z-10 bg-black/40 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
                    <div className="mx-4 px-5 py-4 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-center max-w-xs">
                        <AlertTriangle size={20} className="text-amber-400 mx-auto mb-2" />
                        <p className="text-xs font-black text-amber-300 leading-relaxed">{t('finishCurrentOrder')}</p>
                    </div>
                </div>
            )}

            {/* Search + Category bar */}
            <div className="flex-shrink-0 px-3 pt-3 pb-2 border-b border-[var(--border)] bg-[var(--bg-card)]">
                {/* Search */}
                <div className="relative mb-2">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                    <input
                        type="text"
                        placeholder={t('searchMenu')}
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
                    {categories.filter(c => !c.parent_id).map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                lang === 'km' ? 'khmer' : ''
                            } ${
                                selectedCategory === cat.id || categories.some(c => c.id === selectedCategory && (c.parent_id === cat.id || (c.depth || 0) > 0 && categories.find(p => p.id === c.parent_id)?.parent_id === cat.id))
                                    ? 'bg-[var(--accent)] text-white'
                                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border)] hover:text-[var(--foreground)]'
                            }`}
                        >
                            {lang === 'km' ? (cat.khmer_name || cat.name) : cat.name}
                            {categories.some(c => c.parent_id === cat.id) && <span className="ml-1 opacity-60">›</span>}
                        </button>
                    ))}
                </div>

                {/* Sub-category breadcrumb + sub-pills */}
                {selectedCategory && (() => {
                    // Build ancestor path from root → selectedCategory
                    const getPath = (id: string): Category[] => {
                        const cat = categories.find(c => c.id === id);
                        if (!cat) return [];
                        if (!cat.parent_id) return [cat];
                        return [...getPath(cat.parent_id), cat];
                    };
                    const path = getPath(selectedCategory);
                    const children = categories.filter(c => c.parent_id === selectedCategory);
                    if (path.length === 0) return null;
                    return (
                        <div className="mt-1.5 space-y-1">
                            {/* Breadcrumb */}
                            <div className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
                                <button onClick={() => setSelectedCategory(null)} className="hover:text-[var(--foreground)] transition-colors">All</button>
                                {path.map((cat, i) => (
                                    <span key={cat.id} className="flex items-center gap-1">
                                        <span className="opacity-40">/</span>
                                        <button
                                            onClick={() => setSelectedCategory(cat.id)}
                                            className={`hover:text-[var(--foreground)] transition-colors ${i === path.length - 1 ? 'text-[var(--foreground)] font-bold' : ''}`}
                                        >
                                            {lang === 'km' ? (cat.khmer_name || cat.name) : cat.name}
                                        </button>
                                    </span>
                                ))}
                            </div>
                            {/* Children pills */}
                            {children.length > 0 && (
                                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                                    {children.map(sub => (
                                        <button
                                            key={sub.id}
                                            onClick={() => setSelectedCategory(sub.id)}
                                            className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all ${lang === 'km' ? 'khmer' : ''} ${
                                                selectedCategory === sub.id
                                                    ? 'bg-[var(--accent-blue)] text-white'
                                                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border)] hover:text-[var(--foreground)]'
                                            }`}
                                        >
                                            {lang === 'km' ? (sub.khmer_name || sub.name) : sub.name}
                                            {categories.some(c => c.parent_id === sub.id) && <span className="ml-1 opacity-60">›</span>}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })()}
            </div>

            {/* Product Grid */}
            <div className="flex-1 overflow-y-auto p-3 no-scrollbar">
                {filteredProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-3 opacity-30">
                        <ShoppingBag size={40} className="text-[var(--text-secondary)]" />
                        <p className="text-sm font-semibold text-[var(--text-secondary)]">
                            {searchQuery ? t('noResults') : t('noProducts')}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
                        {sortedFiltered.map((product, idx) => {
                            const isAdding = addingId === product.id;
                            const unavailable = product.is_available === 0;
                            const soldOutToday = !unavailable && !!product.sold_out_today;
                            // Stock-based sold-out is disabled until the nullable stock_quantity
                            // migration (task 3e9cf8ae) lands — the legacy NOT NULL DEFAULT 0
                            // column made every product read as sold out (bug 10287e2e).
                            const isSoldOut = false;
                            const isBlocked = unavailable || soldOutToday;
                            const showingToast = soldOutToastId === product.id;
                            const cardColor = CARD_COLORS[idx % CARD_COLORS.length];
                            const displayName = lang === 'km' ? (product.khmer_name || product.name) : product.name;
                            const displayDescription = ((lang === 'km' ? product.khmer_description : product.description) || product.description || product.khmer_description || '').trim();

                            return (
                                <button
                                    key={product.id}
                                    onClick={(e) => handleProductClick(product, e)}
                                    title={unavailable ? t('unavailable') : soldOutToday ? t('soldOutToday') : isSoldOut ? t('soldOut') : displayDescription ? `${displayName} — ${displayDescription}` : displayName}
                                    className={`group flex flex-col text-left relative overflow-hidden rounded-xl transition-all duration-150 active:scale-95 ${
                                        isAdding ? 'scale-95 ring-2 ring-[var(--accent-green)]' : ''
                                    } ${unavailable ? 'opacity-30 cursor-not-allowed' : soldOutToday ? 'opacity-50 cursor-not-allowed' : isSoldOut ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg hover:-translate-y-0.5 cursor-pointer'}`}
                                    style={{ background: cardColor, border: `1px solid rgba(255,255,255,0.08)` }}
                                >
                                    {/* Image area */}
                                    <div className="relative w-full aspect-square overflow-hidden rounded-xl bg-black/20">
                                        {product.image_path && getImageSrc(product.image_path) ? (
                                            <img
                                                src={getImageSrc(product.image_path)!}
                                                alt={displayName}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <UtensilsCrossed size={32} className="opacity-20 text-white" />
                                            </div>
                                        )}

                                        {/* Badges Overlay */}
                                        {!isSoldOut && product.id === bestSellerId && (
                                            <div className="absolute top-1.5 left-1.5 bg-orange-500 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1 z-10 hover:bg-orange-400">
                                                <Flame size={10} /> {t('bestSeller')}
                                            </div>
                                        )}
                                        {!isSoldOut && product.id !== bestSellerId && product.id === recommendedId && (
                                            <div className="absolute top-1.5 left-1.5 bg-yellow-500 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1 z-10 hover:bg-yellow-400">
                                                <Star size={10} /> {t('recommended')}
                                            </div>
                                        )}
                                        {!isSoldOut && product.id !== bestSellerId && product.id !== recommendedId && (product.created_at && (now - new Date(product.created_at).getTime() < SEVEN_DAYS_MS)) && (
                                            <div className="absolute top-1.5 left-1.5 bg-[var(--accent-blue)] text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1 z-10 hover:brightness-110">
                                                <Sparkles size={10} /> {t('new')}
                                            </div>
                                        )}

                                        {/* Sold Out badge */}
                                        {isSoldOut && (
                                            <div className="absolute top-1.5 right-1.5 bg-red-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-lg z-10">
                                                {t('soldOut')}
                                            </div>
                                        )}

                                        {/* Low-stock badge (only when stock is tracked and > 0) */}
                                        {!isSoldOut && !unavailable && product.stock_quantity != null && product.stock_quantity > 0 && (
                                            <div className={`absolute top-1.5 right-1.5 text-[9px] font-black px-2 py-0.5 rounded-full shadow-lg z-10 ${
                                                product.stock_quantity <= 5
                                                    ? 'bg-amber-500 text-white'
                                                    : 'bg-black/50 text-white'
                                            }`}>
                                                {product.stock_quantity} {t('stockLeft')}
                                            </div>
                                        )}

                                        {/* Sold Out center overlay with toast */}
                                        {isSoldOut && (
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                {showingToast && (
                                                    <span className={`text-[10px] font-black text-white uppercase tracking-widest bg-red-600 px-2 py-1 rounded-full ${lang === 'km' ? 'khmer' : ''}`}>
                                                        {t('soldOut')}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* Add indicator on hover */}
                                        {!isBlocked && (
                                            <div className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full bg-[var(--accent)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                                                <span className="text-white text-xs font-black leading-none">+</span>
                                            </div>
                                        )}

                                        {/* Bulk quantity entry — opens a keypad to add multiple units at once */}
                                        {!isBlocked && (
                                            <span
                                                role="button"
                                                tabIndex={0}
                                                title={t('enterQuantity')}
                                                onClick={(e) => { e.stopPropagation(); openQuantityModal(product); }}
                                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); openQuantityModal(product); } }}
                                                className="absolute bottom-1.5 left-1.5 w-7 h-7 rounded-full bg-black/55 hover:bg-[var(--accent)] text-white flex items-center justify-center shadow-lg z-10 transition-colors cursor-pointer"
                                            >
                                                <PlusCircle size={15} strokeWidth={2.5} />
                                            </span>
                                        )}
                                    </div>

                                    {/* Unavailable full-card overlay (admin-disabled) */}
                                    {unavailable && (
                                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-20 rounded-xl">
                                            <span className={`text-sm font-black text-white uppercase tracking-wider bg-red-600/80 px-3 py-1.5 rounded-xl shadow-lg ${lang === 'km' ? 'khmer' : ''}`}>
                                                {t('unavailable')}
                                            </span>
                                        </div>
                                    )}

                                    {/* Sold Out Today full-card overlay (temporary shift toggle) */}
                                    {soldOutToday && (
                                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-20 rounded-xl">
                                            <span className={`text-xs font-black text-white uppercase tracking-wider text-center bg-red-600/80 px-3 py-1.5 rounded-xl shadow-lg ${lang === 'km' ? 'khmer' : ''}`}>
                                                {t('soldOutToday')}
                                            </span>
                                        </div>
                                    )}

                                    {/* Info area */}
                                    <div className="p-2">
                                        <p className={`text-xs font-semibold text-white leading-tight line-clamp-2 mb-1 ${lang === 'km' ? 'khmer' : ''}`}>
                                            {displayName}
                                        </p>
                                        {displayDescription && (
                                            <p className={`text-[10px] text-white/50 leading-tight line-clamp-1 mb-1 ${lang === 'km' ? 'khmer' : ''}`}>
                                                {displayDescription}
                                            </p>
                                        )}
                                        <p className="text-xs font-bold text-[var(--accent-green)] font-mono">
                                            {formatUsd(product.price_cents)}
                                        </p>
                                        {exchangeRate > 0 && !rateIsDefault && (
                                            <p className="text-[10px] text-white/40 font-mono leading-tight">
                                                ≈ {formatKhr(roundKhr(Math.round(product.price_cents / 100 * exchangeRate)))}
                                            </p>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {qtyModalProduct && (
                <QuantityModal
                    productName={lang === 'km' ? (qtyModalProduct.khmer_name || qtyModalProduct.name) : qtyModalProduct.name}
                    unitPriceCents={qtyModalProduct.price_cents}
                    isKhmer={lang === 'km'}
                    onConfirm={(qty) => {
                        const product = qtyModalProduct;
                        setQtyModalProduct(null);
                        addQuantity(product, qty);
                    }}
                    onClose={() => setQtyModalProduct(null)}
                />
            )}

            {variantPickerProduct && (
                <VariantPickerModal
                    product={variantPickerProduct}
                    onSelect={(variant) => {
                        const product = variantPickerProduct;
                        setVariantPickerProduct(null);
                        addQuantity(product, 1, variant);
                    }}
                    onClose={() => setVariantPickerProduct(null)}
                />
            )}

            {modifierPickerProduct && (
                <ModifierPickerModal
                    product={modifierPickerProduct}
                    onConfirm={(options) => {
                        const product = modifierPickerProduct;
                        setModifierPickerProduct(null);
                        addQuantity(product, 1, undefined, options);
                    }}
                    onClose={() => setModifierPickerProduct(null)}
                />
            )}
        </div>
    );
}
