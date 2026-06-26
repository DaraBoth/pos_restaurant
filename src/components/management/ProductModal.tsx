'use client';
import { useState, useEffect, useRef } from 'react';
import { createProduct, updateProduct, createProductVariant, updateProductVariant, deleteProductVariant, createModifierGroup, updateModifierGroup, deleteModifierGroup, createModifierOption, updateModifierOption, deleteModifierOption } from '@/lib/api/products';
import type { Product, Category, InventoryItem, IngredientInput } from '@/types';
import { useLanguage } from '@/providers/LanguageProvider';
import { useAuth } from '@/providers/AuthProvider';
import { Save, ImagePlus, X, Box, Plus, Trash2 } from 'lucide-react';
import SidebarDrawer from './SidebarDrawer';
import { getImageSrc } from '@/lib/image';
import { getInventoryItems } from '@/lib/api/inventory';
import { CustomSelect } from '@/components/ui/CustomSelect';

interface VariantDraft {
    id?: string;
    name: string;
    name_km: string;
    sku: string;
    priceUsd: string;
    stockQty: string;
}

interface ModOptionDraft {
    id?: string;
    name: string;
    name_km: string;
    priceDeltaUsd: string;
}

interface ModGroupDraft {
    id?: string;
    name: string;
    name_km: string;
    required: boolean;
    multi_select: boolean;
    options: ModOptionDraft[];
}

interface ProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    categories: Category[];
    product?: Product | null;
}

export default function ProductModal({ isOpen, onClose, onSave, categories, product }: ProductModalProps) {
    const { t } = useLanguage();
    const { user } = useAuth();
    const restaurantId = user?.restaurant_id;
    
    // Core Product State
    const [name, setName] = useState('');
    const [khmerName, setKhmerName] = useState('');
    const [description, setDescription] = useState('');
    const [khmerDescription, setKhmerDescription] = useState('');
    const [sku, setSku] = useState('');
    const [priceUsd, setPriceUsd] = useState('0.00');
    const [costPriceUsd, setCostPriceUsd] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [isAvailable, setIsAvailable] = useState(true);
    const [imagePath, setImagePath] = useState('');
    const [loading, setLoading] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Inventory Link State
    const [materials, setMaterials] = useState<InventoryItem[]>([]);
    const [ingredients, setIngredients] = useState<IngredientInput[]>([]);
    const [variants, setVariants] = useState<VariantDraft[]>([]);
    const [removedVariantIds, setRemovedVariantIds] = useState<string[]>([]);
    const [modGroups, setModGroups] = useState<ModGroupDraft[]>([]);
    const [removedGroupIds, setRemovedGroupIds] = useState<string[]>([]);
    const [removedOptionIds, setRemovedOptionIds] = useState<string[]>([]);

    useEffect(() => {
        if (product) {
            setName(product.name);
            setKhmerName(product.khmer_name || '');
            setDescription(product.description || '');
            setKhmerDescription(product.khmer_description || '');
            setSku(product.sku || '');
            setPriceUsd((product.price_cents / 100).toFixed(2));
            setCostPriceUsd(product.cost_price_cents != null ? (product.cost_price_cents / 100).toFixed(2) : '');
            setCategoryId(product.category_id || '');
            setIsAvailable(product.is_available === 1);
            setImagePath(product.image_path || '');
            setIngredients(product.ingredients.map(ing => ({
                inventory_item_id: ing.inventory_item_id,
                usage_quantity: ing.usage_quantity
            })));
            setVariants((product.variants || []).map(v => ({
                id: v.id,
                name: v.name,
                name_km: v.name_km || '',
                sku: v.sku || '',
                priceUsd: (v.price_cents / 100).toFixed(2),
                stockQty: v.stock_quantity != null ? String(v.stock_quantity) : '',
            })));
            setRemovedVariantIds([]);
            setModGroups((product.modifier_groups || []).map(g => ({
                id: g.id,
                name: g.name,
                name_km: g.name_km || '',
                required: g.required !== 0,
                multi_select: g.multi_select !== 0,
                options: g.options.map(o => ({
                    id: o.id,
                    name: o.name,
                    name_km: o.name_km || '',
                    priceDeltaUsd: (o.price_delta_cents / 100).toFixed(2),
                })),
            })));
            setRemovedGroupIds([]);
            setRemovedOptionIds([]);
        } else {
            setName('');
            setKhmerName('');
            setDescription('');
            setKhmerDescription('');
            setSku('');
            setPriceUsd('0.00');
            setCostPriceUsd('');
            setCategoryId(categories[0]?.id || '');
            setIsAvailable(true);
            setImagePath('');
            setIngredients([]);
            setVariants([]);
            setRemovedVariantIds([]);
            setModGroups([]);
            setRemovedGroupIds([]);
            setRemovedOptionIds([]);
        }
        
        // Load materials for linking
        if (isOpen) {
            getInventoryItems(restaurantId || undefined).then(setMaterials).catch(console.error);
        }
        
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, [product, categories, isOpen, restaurantId]);

    async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingImage(true);
        try {
            const dataUri = await new Promise<string>((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    const MAX = 480;
                    const scale = Math.min(1, MAX / Math.max(img.width, img.height));
                    const canvas = document.createElement('canvas');
                    canvas.width  = Math.round(img.width  * scale);
                    canvas.height = Math.round(img.height * scale);
                    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.onerror = reject;
                img.src = URL.createObjectURL(file);
            });
            setImagePath(dataUri);
        } catch (err) {
            console.error('Image upload failed:', err);
            alert('Failed to process image.');
        } finally {
            setUploadingImage(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const priceCents = Math.round(parseFloat(priceUsd || '0') * 100);
        const trimmedCost = costPriceUsd.trim();
        const costPriceCents = trimmedCost === '' ? undefined : Math.round(parseFloat(trimmedCost || '0') * 100);
        setLoading(true);
        try {
            let productId: string;
            if (product) {
                await updateProduct(
                    product.id, name, khmerName, priceCents,
                    categoryId, isAvailable, imagePath || undefined,
                    ingredients,
                    restaurantId || '', sku || undefined,
                    !!product.sold_out_today,
                    description || undefined, khmerDescription || undefined,
                    costPriceCents
                );
                productId = product.id;
            } else {
                productId = await createProduct(
                    categoryId, name, khmerName, priceCents, imagePath,
                    ingredients,
                    restaurantId || undefined, sku || undefined,
                    description || undefined, khmerDescription || undefined,
                    costPriceCents
                );
            }
            await persistVariants(productId);
            await persistModifiers(productId);
            onSave();
            onClose();
        } catch (error) {
            console.error(error);
            alert('Failed to save product');
        } finally {
            setLoading(false);
        }
    }

    async function persistVariants(productId: string) {
        const rid = restaurantId || '';
        // Delete variants the user removed
        for (const vid of removedVariantIds) {
            await deleteProductVariant(vid, rid);
        }
        // Create/update the current rows (skip blank rows)
        for (let i = 0; i < variants.length; i++) {
            const v = variants[i];
            if (!v.name.trim()) continue;
            const price_cents = Math.round(parseFloat(v.priceUsd || '0') * 100);
            const stock_quantity = v.stockQty.trim() === '' ? null : Math.round(parseFloat(v.stockQty));
            if (v.id) {
                await updateProductVariant({
                    id: v.id, name: v.name.trim(), name_km: v.name_km.trim() || undefined,
                    sku: v.sku.trim() || undefined, price_cents, stock_quantity, sort_order: i, restaurant_id: rid,
                });
            } else {
                await createProductVariant({
                    product_id: productId, name: v.name.trim(), name_km: v.name_km.trim() || undefined,
                    sku: v.sku.trim() || undefined, price_cents, stock_quantity, sort_order: i, restaurant_id: rid,
                });
            }
        }
    }

    function updateVariant(idx: number, patch: Partial<VariantDraft>) {
        setVariants(prev => prev.map((v, i) => i === idx ? { ...v, ...patch } : v));
    }

    function removeVariant(idx: number) {
        setVariants(prev => {
            const v = prev[idx];
            if (v?.id) setRemovedVariantIds(ids => [...ids, v.id!]);
            return prev.filter((_, i) => i !== idx);
        });
    }

    function addVariant() {
        setVariants(prev => [...prev, { name: '', name_km: '', sku: '', priceUsd: priceUsd, stockQty: '' }]);
    }

    async function persistModifiers(productId: string) {
        const rid = restaurantId || '';
        for (const oid of removedOptionIds) await deleteModifierOption(oid, rid);
        for (const gid of removedGroupIds) await deleteModifierGroup(gid, rid);
        for (let gi = 0; gi < modGroups.length; gi++) {
            const g = modGroups[gi];
            if (!g.name.trim()) continue;
            let groupId = g.id;
            if (groupId) {
                await updateModifierGroup({ id: groupId, name: g.name.trim(), name_km: g.name_km.trim() || undefined, required: g.required, multi_select: g.multi_select, sort_order: gi, restaurant_id: rid });
            } else {
                groupId = await createModifierGroup({ product_id: productId, name: g.name.trim(), name_km: g.name_km.trim() || undefined, required: g.required, multi_select: g.multi_select, sort_order: gi, restaurant_id: rid });
            }
            for (let oi = 0; oi < g.options.length; oi++) {
                const o = g.options[oi];
                if (!o.name.trim()) continue;
                const delta = Math.round(parseFloat(o.priceDeltaUsd || '0') * 100);
                if (o.id) {
                    await updateModifierOption({ id: o.id, name: o.name.trim(), name_km: o.name_km.trim() || undefined, price_delta_cents: delta, sort_order: oi, restaurant_id: rid });
                } else {
                    await createModifierOption({ group_id: groupId, name: o.name.trim(), name_km: o.name_km.trim() || undefined, price_delta_cents: delta, sort_order: oi, restaurant_id: rid });
                }
            }
        }
    }

    function addModGroup() {
        setModGroups(prev => [...prev, { name: '', name_km: '', required: false, multi_select: false, options: [] }]);
    }
    function updateModGroup(gi: number, patch: Partial<ModGroupDraft>) {
        setModGroups(prev => prev.map((g, i) => i === gi ? { ...g, ...patch } : g));
    }
    function removeModGroup(gi: number) {
        setModGroups(prev => {
            const g = prev[gi];
            if (g?.id) setRemovedGroupIds(ids => [...ids, g.id!]);
            return prev.filter((_, i) => i !== gi);
        });
    }
    function addModOption(gi: number) {
        setModGroups(prev => prev.map((g, i) => i === gi ? { ...g, options: [...g.options, { name: '', name_km: '', priceDeltaUsd: '0.00' }] } : g));
    }
    function updateModOption(gi: number, oi: number, patch: Partial<ModOptionDraft>) {
        setModGroups(prev => prev.map((g, i) => i === gi ? { ...g, options: g.options.map((o, j) => j === oi ? { ...o, ...patch } : o) } : g));
    }
    function removeModOption(gi: number, oi: number) {
        setModGroups(prev => prev.map((g, i) => {
            if (i !== gi) return g;
            const o = g.options[oi];
            if (o?.id) setRemovedOptionIds(ids => [...ids, o.id!]);
            return { ...g, options: g.options.filter((_, j) => j !== oi) };
        }));
    }

    return (
        <SidebarDrawer
            isOpen={isOpen}
            onClose={onClose}
            title={product ? t('editProduct') : t('addProduct')}
            subtitle={product ? product.name : t('addProductSub')}
        >
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                {/* Image upload */}
                <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">
                        {t('productImage') ?? 'Product Image'}
                    </label>
                    <div className="relative">
                        {imagePath && getImageSrc(imagePath) ? (
                            <div className="relative w-full aspect-[3/2] rounded-xl overflow-hidden border border-[var(--border)] group">
                                <img
                                    src={getImageSrc(imagePath)!}
                                    alt="Product"
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploadingImage}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-colors"
                                    >
                                        <ImagePlus size={14} />
                                        Change
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setImagePath('')}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/70 hover:bg-red-500 text-white text-xs font-bold transition-colors"
                                    >
                                        <X size={14} />
                                        Remove
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploadingImage}
                                className="w-full aspect-[3/2] rounded-xl border-2 border-dashed border-[var(--border)] hover:border-[var(--accent)]/40 bg-[var(--bg-elevated)] hover:bg-[var(--bg-dark)] transition-all flex flex-col items-center justify-center gap-2 text-[var(--text-secondary)] hover:text-[var(--foreground)]"
                            >
                                {uploadingImage ? (
                                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <ImagePlus size={28} strokeWidth={1.5} />
                                        <span className="text-xs font-semibold">
                                            {t('uploadImage') ?? 'Upload image'}
                                        </span>
                                        <span className="text-[10px] opacity-60">JPG, PNG, WEBP</span>
                                    </>
                                )}
                            </button>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="hidden"
                            onChange={handleImageUpload}
                        />
                    </div>
                </div>

                {/* Product Name (EN) */}
                <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">
                        {t('productName')} (EN)
                    </label>
                    <input
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder={t('phProductExample')}
                        className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--foreground)] font-semibold placeholder:text-[var(--text-secondary)]/50 focus:border-[var(--accent)] outline-none transition-all"
                    />
                </div>

                {/* Product Name (KH) */}
                <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">
                        {t('khmerName')}
                    </label>
                    <input
                        value={khmerName}
                        onChange={e => setKhmerName(e.target.value)}
                        placeholder="បាយឆា"
                        className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--foreground)] font-semibold khmer placeholder:text-[var(--text-secondary)]/50 focus:border-[var(--accent)] outline-none transition-all"
                    />
                </div>

                {/* Description (EN) */}
                <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">
                        {t('description')} (EN)
                    </label>
                    <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        rows={2}
                        placeholder={t('phAllergenExample')}
                        className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--foreground)] text-sm placeholder:text-[var(--text-secondary)]/50 focus:border-[var(--accent)] outline-none transition-all resize-none"
                    />
                </div>

                {/* Description (KH) */}
                <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">
                        {t('khmerDescription')}
                    </label>
                    <textarea
                        value={khmerDescription}
                        onChange={e => setKhmerDescription(e.target.value)}
                        rows={2}
                        placeholder="មានសណ្តែកដី។ ហឹរ។"
                        className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--foreground)] text-sm khmer placeholder:text-[var(--text-secondary)]/50 focus:border-[var(--accent)] outline-none transition-all resize-none"
                    />
                </div>

                {/* SKU / Product Code */}
                <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">
                        {t('skuCode') ?? 'SKU / Code'}
                    </label>
                    <input
                        value={sku}
                        onChange={e => setSku(e.target.value)}
                        placeholder={t('phSkuExample')}
                        className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--foreground)] font-mono placeholder:text-[var(--text-secondary)]/50 focus:border-[var(--accent)] outline-none transition-all"
                    />
                </div>

                {/* Selling price + Cost price (cost is staff-facing only) */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">
                            {t('price')}
                        </label>
                        <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[var(--text-secondary)]">$</span>
                            <input
                                type="number"
                                required
                                min="0"
                                step="0.01"
                                value={priceUsd}
                                onChange={e => setPriceUsd(e.target.value)}
                                onBlur={() => setPriceUsd(v => parseFloat(v || '0').toFixed(2))}
                                className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl pl-7 pr-4 py-3 text-[var(--foreground)] font-mono font-bold focus:border-[var(--accent)] outline-none transition-all"
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">
                            {t('costPrice')}
                        </label>
                        <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[var(--text-secondary)]">$</span>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={costPriceUsd}
                                onChange={e => setCostPriceUsd(e.target.value)}
                                placeholder="—"
                                className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl pl-7 pr-4 py-3 text-[var(--foreground)] font-mono font-bold focus:border-[var(--accent)] outline-none transition-all"
                            />
                        </div>
                    </div>
                </div>
                {(() => {
                    const sell = parseFloat(priceUsd || '0');
                    const cost = parseFloat(costPriceUsd || '0');
                    if (costPriceUsd.trim() === '' || !(sell > 0)) return null;
                    const margin = Math.round(((sell - cost) / sell) * 100);
                    return (
                        <p className={`text-[11px] font-bold ${margin >= 0 ? 'text-[var(--accent-green)]' : 'text-red-400'}`}>
                            {t('profitMargin')}: {margin}%
                        </p>
                    );
                })()}

                {/* Category */}
                <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">
                        {t('category')}
                    </label>
                    <CustomSelect
                        value={categoryId}
                        onChange={(val) => setCategoryId(val)}
                        options={categories.map(cat => ({
                            value: cat.id,
                            label: `${'\u00a0\u00a0\u00a0'.repeat(cat.depth || 0)}${(cat.depth || 0) > 0 ? '└ ' : ''}${cat.name}`
                        }))}
                    />
                </div>

                {/* Inventory Link */}
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl space-y-4 shadow-[0_0_15px_rgba(16,185,129,0.03)]">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                            <Box size={14} className="text-emerald-400" />
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Inventory Ingredients</h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIngredients([...ingredients, { inventory_item_id: '', usage_quantity: 1 }])}
                            className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 p-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                            <Plus size={12} strokeWidth={3} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Add</span>
                        </button>
                    </div>
                    
                    <div className="space-y-3">
                        {ingredients.length === 0 && (
                            <div className="text-center py-4 border-2 border-dashed border-[var(--border)] rounded-xl">
                                <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold opacity-40">No ingredients linked</p>
                            </div>
                        )}
                        {ingredients.map((ing, idx) => (
                            <div key={idx} className="flex flex-col gap-2 p-3 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl animate-in fade-in slide-in-from-top-1">
                                <div className="flex items-center gap-2">
                                    <CustomSelect
                                        value={ing.inventory_item_id}
                                        onChange={(val) => {
                                            const newIngs = [...ingredients];
                                            newIngs[idx].inventory_item_id = val;
                                            setIngredients(newIngs);
                                        }}
                                        options={[
                                            { label: '-- Select Material --', value: '' },
                                            ...materials.map(m => ({ label: `${m.name} (${m.unit_label})`, value: m.id }))
                                        ]}
                                        className="flex-1"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setIngredients(ingredients.filter((_, i) => i !== idx))}
                                        className="text-red-400 hover:text-red-300 p-2 rounded-lg hover:bg-red-400/10 transition-colors"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="number"
                                            step="0.001"
                                            min="0"
                                            value={ing.usage_quantity}
                                            onChange={e => {
                                                const newIngs = [...ingredients];
                                                newIngs[idx].usage_quantity = parseFloat(e.target.value) || 0;
                                                setIngredients(newIngs);
                                            }}
                                            placeholder={t('phUsageAmount')}
                                            className="w-full bg-[var(--bg-dark)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--foreground)] font-mono placeholder:text-[var(--text-secondary)]/40 outline-none focus:border-emerald-500"
                                        />
                                    </div>
                                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest min-w-[40px]">
                                        {materials.find(m => m.id === ing.inventory_item_id)?.unit_label || 'unit'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Availability toggle */}
                <div className="flex items-center justify-between px-4 py-3 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl">
                    <span className="text-sm font-semibold text-[var(--foreground)]">{t('available')}</span>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={isAvailable}
                            onChange={e => setIsAvailable(e.target.checked)}
                            className="hidden"
                        />
                        <div className={`w-11 h-6 rounded-full relative transition-colors duration-200 ${isAvailable ? 'bg-green-500' : 'bg-white/20'}`}>
                            <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${isAvailable ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                        <span className={`text-sm font-bold w-20 ${isAvailable ? 'text-green-600' : 'text-[var(--text-secondary)]'}`}>
                            {isAvailable ? t('available') : t('unavailable')}
                        </span>
                    </label>
                </div>

                {/* Variants */}
                <div className="space-y-2 border border-[var(--border)] rounded-xl p-3 bg-[var(--bg-elevated)]/40">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-widest text-[var(--text-secondary)]">{t('variants')}</span>
                        <button
                            type="button"
                            onClick={addVariant}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent)] text-[10px] font-black uppercase tracking-wider hover:bg-[var(--accent)]/20 transition-all"
                        >
                            <Plus size={12} strokeWidth={3} /> {t('addVariant')}
                        </button>
                    </div>
                    {variants.length === 0 ? (
                        <p className="text-[11px] text-[var(--text-secondary)] opacity-60 py-1">{t('noVariants')}</p>
                    ) : (
                        <div className="space-y-2">
                            {variants.map((v, idx) => (
                                <div key={v.id ?? `new-${idx}`} className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)]">
                                    <input
                                        value={v.name}
                                        onChange={e => updateVariant(idx, { name: e.target.value })}
                                        placeholder={t('variantName')}
                                        className="flex-1 min-w-[90px] bg-[var(--bg-dark)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-xs font-semibold text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                                    />
                                    <input
                                        value={v.name_km}
                                        onChange={e => updateVariant(idx, { name_km: e.target.value })}
                                        placeholder="ខ្មែរ"
                                        className="flex-1 min-w-[80px] bg-[var(--bg-dark)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-xs font-semibold text-[var(--foreground)] khmer outline-none focus:border-[var(--accent)]"
                                    />
                                    <input
                                        type="number" step="0.01" min="0"
                                        value={v.priceUsd}
                                        onChange={e => updateVariant(idx, { priceUsd: e.target.value })}
                                        placeholder={t('variantPrice')}
                                        title={t('variantPrice')}
                                        className="w-[80px] bg-[var(--bg-dark)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                                    />
                                    <input
                                        type="number" step="1" min="0"
                                        value={v.stockQty}
                                        onChange={e => updateVariant(idx, { stockQty: e.target.value })}
                                        placeholder={t('stockLeft') ?? 'Stock'}
                                        title={t('stockLeft') ?? 'Stock'}
                                        className="w-[64px] bg-[var(--bg-dark)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-xs font-mono text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeVariant(idx)}
                                        className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-red-500 hover:bg-red-500/10 transition-all"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Modifier groups */}
                <div className="space-y-2 border border-[var(--border)] rounded-xl p-3 bg-[var(--bg-elevated)]/40">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-widest text-[var(--text-secondary)]">{t('modifierGroups')}</span>
                        <button
                            type="button"
                            onClick={addModGroup}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent)] text-[10px] font-black uppercase tracking-wider hover:bg-[var(--accent)]/20 transition-all"
                        >
                            <Plus size={12} strokeWidth={3} /> {t('addModifierGroup')}
                        </button>
                    </div>
                    {modGroups.length === 0 ? (
                        <p className="text-[11px] text-[var(--text-secondary)] opacity-60 py-1">{t('noModifierGroups')}</p>
                    ) : (
                        <div className="space-y-3">
                            {modGroups.map((g, gi) => (
                                <div key={g.id ?? `ng-${gi}`} className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-2.5 space-y-2">
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            value={g.name}
                                            onChange={e => updateModGroup(gi, { name: e.target.value })}
                                            placeholder={t('groupName')}
                                            className="flex-1 min-w-[80px] bg-[var(--bg-dark)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-xs font-bold text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                                        />
                                        <input
                                            value={g.name_km}
                                            onChange={e => updateModGroup(gi, { name_km: e.target.value })}
                                            placeholder="ខ្មែរ"
                                            className="flex-1 min-w-[70px] bg-[var(--bg-dark)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-xs font-bold text-[var(--foreground)] khmer outline-none focus:border-[var(--accent)]"
                                        />
                                        <button type="button" onClick={() => removeModGroup(gi)} className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-red-500 hover:bg-red-500/10 transition-all">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-3 text-[10px] font-bold text-[var(--text-secondary)]">
                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input type="checkbox" checked={g.required} onChange={e => updateModGroup(gi, { required: e.target.checked })} />
                                            {t('required')}
                                        </label>
                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input type="checkbox" checked={g.multi_select} onChange={e => updateModGroup(gi, { multi_select: e.target.checked })} />
                                            {t('multiSelect')}
                                        </label>
                                    </div>
                                    <div className="space-y-1.5 pl-1">
                                        {g.options.map((o, oi) => (
                                            <div key={o.id ?? `no-${oi}`} className="flex items-center gap-1.5">
                                                <input
                                                    value={o.name}
                                                    onChange={e => updateModOption(gi, oi, { name: e.target.value })}
                                                    placeholder={t('variantName')}
                                                    className="flex-1 min-w-[70px] bg-[var(--bg-dark)] border border-[var(--border)] rounded-lg px-2 py-1 text-xs text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                                                />
                                                <input
                                                    value={o.name_km}
                                                    onChange={e => updateModOption(gi, oi, { name_km: e.target.value })}
                                                    placeholder="ខ្មែរ"
                                                    className="flex-1 min-w-[60px] bg-[var(--bg-dark)] border border-[var(--border)] rounded-lg px-2 py-1 text-xs text-[var(--foreground)] khmer outline-none focus:border-[var(--accent)]"
                                                />
                                                <input
                                                    type="number" step="0.01"
                                                    value={o.priceDeltaUsd}
                                                    onChange={e => updateModOption(gi, oi, { priceDeltaUsd: e.target.value })}
                                                    title={t('priceDelta')}
                                                    className="w-[64px] bg-[var(--bg-dark)] border border-[var(--border)] rounded-lg px-2 py-1 text-xs font-mono text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                                                />
                                                <button type="button" onClick={() => removeModOption(gi, oi)} className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-red-500 hover:bg-red-500/10 transition-all">
                                                    <X size={13} />
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => addModOption(gi)}
                                            className="flex items-center gap-1 text-[10px] font-bold text-[var(--accent-blue)] hover:brightness-110 transition-all"
                                        >
                                            <Plus size={11} /> {t('addOption')}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3.5 rounded-xl text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--bg-elevated)] transition-all"
                    >
                        {t('cancel')}
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 py-3.5 rounded-xl bg-[var(--accent)] text-white font-bold text-sm hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-[var(--accent)]/20"
                    >
                        {loading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Save size={16} strokeWidth={2.5} />
                        )}
                        {product ? t('save') : t('addProduct')}
                    </button>
                </div>
            </form>
        </SidebarDrawer>
    );
}
