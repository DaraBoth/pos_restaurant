'use client';
import { useState, useEffect, useRef } from 'react';
import {
    getProducts, getCategories, deleteProduct,
    deleteCategory, setSoldOutToday
} from '@/lib/api/products';
import { useAuth } from '@/providers/AuthProvider';
import type { Product, Category } from '@/types';
import { useLanguage } from '@/providers/LanguageProvider';
import { formatUsd, formatKhr, roundKhr } from '@/lib/currency';
import { getExchangeRate } from '@/lib/api/system';
import { 
    Package, Plus, Trash2, Box, Minus, Edit3,
    Image as ImageIcon, Search, Layers, Ban, Download
} from 'lucide-react';
import ProductModal from '@/components/management/ProductModal';
import CategoryModal from '@/components/management/CategoryModal';
import { getImageSrc } from '@/lib/image';
import { canDelete } from '@/lib/permissions';

export default function ProductsManagement() {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'products' | 'categories'>('products');
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 50;
    const [exchangeRate, setExchangeRate] = useState(0);
    const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'product' | 'category'; id: string; name: string; warning?: string } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [exportToast, setExportToast] = useState<{ msg: string; ok: boolean } | null>(null);
    const [exporting, setExporting] = useState(false);
    const exportToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { t, lang } = useLanguage();
    const { user } = useAuth();
    const restaurantId = user?.restaurant_id;

    // Khmer must never get letter-spacing/uppercase (it shatters stacked glyphs) and
    // needs the `khmer` font class. Use these instead of literal `uppercase tracking-*`.
    const km = lang === 'km';
    const labelCase = km ? 'khmer' : 'uppercase tracking-widest';
    const labelCaseWide = km ? 'khmer' : 'uppercase tracking-wider';
    const thClass = `px-4 py-2.5 text-[10px] font-black ${labelCase} text-[var(--text-secondary)] border-b border-[var(--border)]`;

    useEffect(() => {
        loadData();
    }, []);

    // Reset to first page whenever the visible dataset changes.
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, activeTab]);

    async function loadData() {
        if (!restaurantId) return;
        setIsLoading(true);
        setFetchError(null);
        try {
            const [cats, prods, rateData] = await Promise.all([
                getCategories(restaurantId),
                getProducts(undefined, restaurantId),
                getExchangeRate(restaurantId),
            ]);
            setCategories(cats);
            setProducts(prods);
            if (rateData?.rate) setExchangeRate(rateData.rate);
        } catch (e) {
            console.error(e);
            setFetchError(t('error'));
        } finally {
            setIsLoading(false);
        }
    }

    function showExportToast(msg: string, ok: boolean) {
        if (exportToastTimer.current) clearTimeout(exportToastTimer.current);
        setExportToast({ msg, ok });
        exportToastTimer.current = setTimeout(() => setExportToast(null), 3000);
    }

    async function handleExportProducts() {
        if (products.length === 0) return;
        setExporting(true);
        try {
            const XLSX = await import('xlsx');
            const catName = (id?: string) => categories.find(c => c.id === id)?.name || '';
            const rows = products.map(p => ({
                'Name': p.name,
                'Khmer Name': p.khmer_name || '',
                'Category': catName(p.category_id) || p.category_name || '',
                'Price (USD)': (p.price_cents / 100).toFixed(2),
                'Price (KHR approx)': exchangeRate > 0 ? roundKhr(p.price_cents, exchangeRate) : '',
                'SKU': p.sku || '',
                'Stock Qty': p.stock_quantity ?? '',
                'Available': p.is_available === 1 ? 'Yes' : 'No',
            }));
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Products');
            XLSX.writeFile(wb, `dineos-products-${new Date().toISOString().slice(0, 10)}.xlsx`);
            showExportToast(t('exportSuccessMsg'), true);
        } catch (err) {
            console.error('Product export failed:', err);
            showExportToast(t('exportFailedMsg'), false);
        } finally {
            setExporting(false);
        }
    }

    async function handleDeleteProduct(id: string) {
        if (!canDelete(user?.role) || !user?.id) {
            alert(t('permissionDeniedDelete'));
            return;
        }
        const p = products.find(pr => pr.id === id);
        const name = p ? (p.khmer_name ? `${p.name} (${p.khmer_name})` : p.name) : id;
        setDeleteConfirm({ type: 'product', id, name });
    }

    async function confirmDeleteProduct(id: string) {
        if (!user?.id) return;
        try {
            await deleteProduct(id, restaurantId || '', user.id);
            loadData();
        } catch (e) {
            console.error(e);
            alert(t('error'));
        }
    }

    async function handleDeleteCategory(id: string) {
        if (!canDelete(user?.role) || !user?.id) {
            alert(t('permissionDeniedDelete'));
            return;
        }
        const getDescendantIds = (catId: string): string[] => {
            const children = categories.filter(c => c.parent_id === catId);
            return [catId, ...children.flatMap(c => getDescendantIds(c.id))];
        };
        const allIds = getDescendantIds(id);
        const hasProducts = products.some(p => allIds.includes(p.category_id || ''));
        if (hasProducts) {
            alert(t('categoryHasProducts') ?? 'Cannot delete: this category still contains products. Please move or delete them first.');
            return;
        }
        const hasChildren = categories.some(c => c.parent_id === id);
        if (hasChildren) {
            alert(t('categoryHasChildren') ?? 'Cannot delete: this category still has sub-categories. Please delete or reassign them first.');
            return;
        }
        const c = categories.find(cat => cat.id === id);
        const name = c ? (c.khmer_name ? `${c.name} (${c.khmer_name})` : c.name) : id;
        setDeleteConfirm({ type: 'category', id, name });
    }

    async function confirmDeleteCategory(id: string) {
        if (!user?.id) return;
        try {
            await deleteCategory(id, restaurantId || '', user.id);
            loadData();
        } catch (e) {
            console.error(e);
            alert(t('error'));
        }
    }

    async function executeDelete() {
        if (!deleteConfirm) return;
        setDeleteConfirm(null);
        if (deleteConfirm.type === 'product') {
            await confirmDeleteProduct(deleteConfirm.id);
        } else {
            await confirmDeleteCategory(deleteConfirm.id);
        }
    }

    async function handleToggleSoldOut(p: Product) {
        if (!restaurantId) return;
        // Optimistic flip so the one-tap toggle feels instant on touch hardware.
        setProducts(prev => prev.map(x => x.id === p.id ? { ...x, sold_out_today: !p.sold_out_today } : x));
        try {
            await setSoldOutToday(p.id, !p.sold_out_today, restaurantId);
        } catch (e) {
            console.error(e);
            alert(t('error'));
            loadData();
        }
    }



    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.khmer_name && p.khmer_name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const filteredCategories = categories.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.khmer_name && c.khmer_name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const activeCount = activeTab === 'products' ? filteredProducts.length : filteredCategories.length;
    const totalPages = Math.max(1, Math.ceil(activeCount / PAGE_SIZE));
    const pageSafe = Math.min(currentPage, totalPages);
    const pageStart = (pageSafe - 1) * PAGE_SIZE;
    const pagedProducts = filteredProducts.slice(pageStart, pageStart + PAGE_SIZE);
    const pagedCategories = filteredCategories.slice(pageStart, pageStart + PAGE_SIZE);
    const showPagination = activeCount > PAGE_SIZE;
    const rangeFrom = activeCount === 0 ? 0 : pageStart + 1;
    const rangeTo = Math.min(pageStart + PAGE_SIZE, activeCount);

    const paginationBar = showPagination ? (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-t border-[var(--border)] bg-[var(--bg-elevated)]">
            <span className={`text-xs text-[var(--text-secondary)] ${km ? 'khmer' : ''}`}>
                {t('paginationShowing')
                    .replace('{from}', String(rangeFrom))
                    .replace('{to}', String(rangeTo))
                    .replace('{total}', String(activeCount))}
            </span>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={pageSafe <= 1}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-all disabled:opacity-40 disabled:pointer-events-none ${km ? 'khmer' : ''}`}
                >
                    {t('paginationPrev')}
                </button>
                <span className={`text-xs font-bold text-[var(--foreground)] tabular-nums ${km ? 'khmer' : ''}`}>
                    {t('paginationPage')
                        .replace('{page}', String(pageSafe))
                        .replace('{pages}', String(totalPages))}
                </span>
                <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={pageSafe >= totalPages}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-all disabled:opacity-40 disabled:pointer-events-none ${km ? 'khmer' : ''}`}
                >
                    {t('paginationNext')}
                </button>
            </div>
        </div>
    ) : null;

    return (
        <div className="animate-fade-in space-y-3 pb-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Segmented tab control — the primary Products/Categories switch */}
                <div
                    role="tablist"
                    aria-label={t('products')}
                    className="inline-flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)]"
                >
                    <button
                        role="tab"
                        aria-selected={activeTab === 'products'}
                        onClick={() => setActiveTab('products')}
                        className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${km ? 'khmer' : ''} ${activeTab === 'products' ? 'bg-[var(--accent)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--foreground)]'}`}
                    >
                        <Package size={14} strokeWidth={2.5} />
                        {t('products')}
                    </button>
                    <button
                        role="tab"
                        aria-selected={activeTab === 'categories'}
                        onClick={() => setActiveTab('categories')}
                        className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${km ? 'khmer' : ''} ${activeTab === 'categories' ? 'bg-[var(--accent)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--foreground)]'}`}
                    >
                        <Layers size={14} strokeWidth={2.5} />
                        {t('category')}
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                        <input
                            type="text"
                            placeholder={t('searchItems')}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg pl-8 pr-3 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--text-secondary)] outline-none focus:border-[var(--accent)] transition-colors w-44"
                        />
                    </div>
                    {activeTab === 'products' && (
                        <button
                            onClick={handleExportProducts}
                            disabled={exporting || products.length === 0}
                            className={`px-3 py-2 text-xs font-bold flex items-center gap-1.5 flex-shrink-0 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-all disabled:opacity-40 ${km ? 'khmer' : ''}`}
                        >
                            <Download size={13} strokeWidth={2.5} />
                            {t('exportProducts')}
                        </button>
                    )}
                    <button
                        onClick={() => {
                            if (activeTab === 'products') { setEditingProduct(null); setIsProductModalOpen(true); }
                            else { setEditingCategory(null); setIsCategoryModalOpen(true); }
                        }}
                        className={`pos-btn-primary px-3 py-2 text-xs font-bold flex items-center gap-1.5 flex-shrink-0 ${km ? 'khmer' : ''}`}
                    >
                        <Plus size={13} strokeWidth={2.5} />
                        {activeTab === 'products' ? t('newProduct') : t('newCategory')}
                    </button>
                </div>
            </div>

            {exportToast && (
                <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-3 rounded-xl text-xs font-bold shadow-2xl border ${exportToast.ok ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-red-500/15 border-red-500/30 text-red-300'}`}>
                    {exportToast.msg}
                </div>
            )}

            {/* Products table */}
            {activeTab === 'products' ? (
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
                    <div className="overflow-auto max-h-[calc(100vh-260px)]">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-10">
                                <tr className="bg-[var(--bg-elevated)]">
                                    <th className={`${thClass} w-12`}>{t('visualCol')}</th>
                                    <th className={thClass}>{t('products')}</th>
                                    <th className={thClass}>{t('category')}</th>
                                    <th className={thClass}>{t('stockCol')}</th>
                                    <th className={`${thClass} text-right`}>{t('price')}</th>
                                    <th className={`${thClass} text-right w-36`}>{t('actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                                {isLoading && Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-4 py-3"><div className="w-9 h-9 rounded-lg bg-white/[0.05]" /></td>
                                        <td className="px-4 py-3"><div className="h-3 bg-white/[0.05] rounded w-28" /></td>
                                        <td className="px-4 py-3"><div className="h-3 bg-white/[0.05] rounded w-20" /></td>
                                        <td className="px-4 py-3"><div className="h-3 bg-white/[0.05] rounded w-10" /></td>
                                        <td className="px-4 py-3"><div className="h-3 bg-white/[0.05] rounded w-14 ml-auto" /></td>
                                        <td className="px-4 py-3"><div className="h-7 bg-white/[0.05] rounded w-16 ml-auto" /></td>
                                    </tr>
                                ))}
                                {!isLoading && fetchError && (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-10 text-center">
                                            <p className="text-sm text-red-400 font-bold mb-2">{fetchError}</p>
                                            <button onClick={loadData} className="text-xs text-[var(--accent-blue)] font-bold hover:underline">{t('retry')}</button>
                                        </td>
                                    </tr>
                                )}
                                {!isLoading && !fetchError && pagedProducts.map(p => (
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
                                            {p.sku && <div className="text-[10px] text-[var(--text-secondary)]/60 font-mono mt-0.5">{p.sku}</div>}
                                            {p.is_available === 0 && (
                                                <span className={`mt-1 inline-block px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 text-[9px] font-bold ${labelCaseWide} border border-red-500/20`}>{t('unavailable')}</span>
                                            )}
                                            {p.sold_out_today && (
                                                <span className={`mt-1 ml-1 inline-block px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[9px] font-bold ${labelCaseWide} border border-amber-500/20`}>{t('soldOutToday')}</span>
                                            )}
                                        </td>
                                        {/* Category */}
                                        <td className="px-4 py-2.5">
                                            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${labelCaseWide} px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/10 text-[var(--text-secondary)]`}>
                                                <Box size={10} className="text-[var(--accent)]" />
                                                {p.category_name}
                                            </span>
                                        </td>

                                        {/* Stock */}
                                        <td className="px-4 py-2.5">
                                            {p.stock_quantity == null ? (
                                                <span className="text-xs text-[var(--text-secondary)] opacity-40">—</span>
                                            ) : p.stock_quantity === 0 ? (
                                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 ${labelCaseWide}`}>{t('outOfStock')}</span>
                                            ) : p.stock_quantity <= 5 ? (
                                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 ${labelCaseWide}`}>{p.stock_quantity}</span>
                                            ) : (
                                                <span className="text-xs text-[var(--text-secondary)]">{p.stock_quantity}</span>
                                            )}
                                        </td>
                                        {/* Price */}
                                        <td className="px-4 py-2.5 text-right">
                                            <span className="font-mono font-bold text-sm text-[var(--accent)]">{formatUsd(p.price_cents)}</span>
                                            {exchangeRate > 0 && (
                                                <div className="text-[10px] font-mono text-[var(--text-secondary)]/60 mt-0.5">
                                                    ≈ {formatKhr(roundKhr(p.price_cents, exchangeRate))}
                                                </div>
                                            )}
                                        </td>
                                        {/* Actions */}
                                        <td className="px-4 py-2.5 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    onClick={() => handleToggleSoldOut(p)}
                                                    title={p.sold_out_today ? t('unmarkSoldOut') : t('markSoldOut')}
                                                    aria-label={p.sold_out_today ? t('unmarkSoldOut') : t('markSoldOut')}
                                                    aria-pressed={!!p.sold_out_today}
                                                    className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all ${
                                                        p.sold_out_today
                                                            ? 'bg-amber-500 border-amber-500 text-white hover:bg-amber-600'
                                                            : 'bg-white/[0.05] border-white/10 text-white/50 hover:text-white hover:border-white/30'
                                                    }`}
                                                >
                                                    <Ban size={13} />
                                                </button>
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        onClick={() => { setEditingProduct(p); setIsProductModalOpen(true); }}
                                                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.05] border border-white/10 hover:bg-[var(--accent)] hover:border-[var(--accent)] hover:text-white text-white/50 transition-all"
                                                    >
                                                        <Edit3 size={13} />
                                                    </button>
                                                    {canDelete(user?.role) && (
                                                        <button
                                                            onClick={() => handleDeleteProduct(p.id)}
                                                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.05] border border-white/10 hover:bg-red-500 hover:border-red-500 hover:text-white text-white/50 transition-all"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {!isLoading && !fetchError && filteredProducts.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-10 text-center text-sm text-[var(--text-secondary)]">
                                            {t('noProducts')}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {paginationBar}
                </div>
            ) : (
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
                    <div className="overflow-auto max-h-[calc(100vh-260px)]">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-10">
                                <tr className="bg-[var(--bg-elevated)]">
                                    <th className={thClass}>{t('categoryName')}</th>
                                    <th className={thClass}>{t('products')}</th>
                                    <th className={`${thClass} text-right w-28`}>{t('actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                                {pagedCategories.map(c => (
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
                                                {products.filter(p => p.category_id === c.id).length} {t('items')}
                                                {categories.some(sub => sub.parent_id === c.id) && (
                                                    <span className="ml-2 text-[var(--accent)] opacity-70">
                                                        · {categories.filter(sub => sub.parent_id === c.id).length} {t('subCatsCount')}
                                                    </span>
                                                )}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    onClick={() => { setEditingCategory(c); setIsCategoryModalOpen(true); }}
                                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.05] border border-white/10 hover:bg-[var(--accent)] hover:border-[var(--accent)] hover:text-white text-white/50 transition-all"
                                                >
                                                    <Edit3 size={13} />
                                                </button>
                                                {canDelete(user?.role) && (
                                                    <button
                                                        onClick={() => handleDeleteCategory(c.id)}
                                                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.05] border border-white/10 hover:bg-red-500 hover:border-red-500 hover:text-white text-white/50 transition-all"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredCategories.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-4 py-10 text-center text-sm text-[var(--text-secondary)]">
                                            {t('noCategories')}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {paginationBar}
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

            {deleteConfirm && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60">
                    <div className="pos-card p-6 max-w-sm mx-4 space-y-4">
                        <h3 className={`text-sm font-black text-red-400 ${labelCase}`}>
                            {deleteConfirm.type === 'product' ? t('deleteProductConfirm') : t('deleteCategory')}
                        </h3>
                        <p className="text-sm font-bold text-[var(--foreground)] truncate" title={deleteConfirm.name}>
                            &quot;{deleteConfirm.name}&quot;
                        </p>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                            {t('deleteCannotUndo')}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className={`flex-1 py-2.5 rounded-xl text-xs font-bold ${labelCase} border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-all`}
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={executeDelete}
                                className={`flex-1 py-2.5 rounded-xl text-xs font-bold ${labelCase} bg-red-500 text-white hover:bg-red-600 transition-all`}
                            >
                                {t('delete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
