'use client';
import { useState, useEffect, useRef } from 'react';
import { createProduct, updateProduct } from '@/lib/api/products';
import type { Product, Category, InventoryItem, IngredientInput } from '@/types';
import { useLanguage } from '@/providers/LanguageProvider';
import { useAuth } from '@/providers/AuthProvider';
import { Save, ImagePlus, X, Box, Plus, Trash2 } from 'lucide-react';
import SidebarDrawer from './SidebarDrawer';
import { getImageSrc } from '@/lib/image';
import { getInventoryItems } from '@/lib/api/inventory';

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
    const [priceUsd, setPriceUsd] = useState('0.00');
    const [categoryId, setCategoryId] = useState('');
    const [isAvailable, setIsAvailable] = useState(true);
    const [imagePath, setImagePath] = useState('');
    const [loading, setLoading] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Inventory Link State
    const [materials, setMaterials] = useState<InventoryItem[]>([]);
    const [ingredients, setIngredients] = useState<IngredientInput[]>([]);

    useEffect(() => {
        if (product) {
            setName(product.name);
            setKhmerName(product.khmer_name || '');
            setPriceUsd((product.price_cents / 100).toFixed(2));
            setCategoryId(product.category_id || '');
            setIsAvailable(product.is_available === 1);
            setImagePath(product.image_path || '');
            setIngredients(product.ingredients.map(ing => ({
                inventory_item_id: ing.inventory_item_id,
                usage_quantity: ing.usage_quantity
            })));
        } else {
            setName('');
            setKhmerName('');
            setPriceUsd('0.00');
            setCategoryId(categories[0]?.id || '');
            setIsAvailable(true);
            setImagePath('');
            setIngredients([]);
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
        setLoading(true);
        try {
            if (product) {
                await updateProduct(
                    product.id, name, khmerName, priceCents,
                    categoryId, isAvailable, imagePath || undefined,
                    ingredients,
                    restaurantId || ''
                );
            } else {
                await createProduct(
                    categoryId, name, khmerName, priceCents, imagePath, 
                    ingredients,
                    restaurantId || undefined
                );
            }
            onSave();
            onClose();
        } catch (error) {
            console.error(error);
            alert('Failed to save product');
        } finally {
            setLoading(false);
        }
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
                            <div className="relative w-full aspect-[3/2] rounded-xl overflow-hidden border border-white/20 group">
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
                                className="w-full aspect-[3/2] rounded-xl border-2 border-dashed border-white/20 hover:border-white/40 bg-white/[0.03] hover:bg-white/[0.06] transition-all flex flex-col items-center justify-center gap-2 text-white/40 hover:text-white/70"
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
                        placeholder="e.g. Fried Rice"
                        className="w-full bg-white/[0.07] border border-white/20 rounded-xl px-4 py-3 text-white font-semibold placeholder:text-white/30 focus:border-[var(--accent)] focus:bg-white/[0.09] outline-none transition-all"
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
                        className="w-full bg-white/[0.07] border border-white/20 rounded-xl px-4 py-3 text-white font-semibold khmer placeholder:text-white/30 focus:border-[var(--accent)] focus:bg-white/[0.09] outline-none transition-all"
                    />
                </div>

                {/* Price + Inventory */}
                <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">
                            {t('price')}
                        </label>
                        <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-white/50">$</span>
                            <input
                                type="number"
                                required
                                min="0"
                                step="0.01"
                                value={priceUsd}
                                onChange={e => setPriceUsd(e.target.value)}
                                onBlur={() => setPriceUsd(v => parseFloat(v || '0').toFixed(2))}
                                className="w-full bg-white/[0.07] border border-white/20 rounded-xl pl-7 pr-4 py-3 text-white font-mono font-bold focus:border-[var(--accent)] focus:bg-white/[0.09] outline-none transition-all"
                            />
                        </div>
                    </div>
                </div>

                {/* Category */}
                <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">
                        {t('category')}
                    </label>
                    <select
                        value={categoryId}
                        onChange={e => setCategoryId(e.target.value)}
                        className="w-full bg-white/[0.07] border border-white/20 rounded-xl px-4 py-3 text-white font-semibold focus:border-[var(--accent)] focus:bg-white/[0.09] outline-none transition-all appearance-none cursor-pointer"
                    >
                        {categories.map(cat => (
                            <option key={cat.id} value={cat.id} className="bg-[#1e2229] text-white">{cat.name}</option>
                        ))}
                    </select>
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
                            <div className="text-center py-4 border-2 border-dashed border-white/5 rounded-xl">
                                <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">No ingredients linked</p>
                            </div>
                        )}
                        {ingredients.map((ing, idx) => (
                            <div key={idx} className="flex flex-col gap-2 p-3 bg-white/[0.03] border border-white/10 rounded-xl animate-in fade-in slide-in-from-top-1">
                                <div className="flex items-center gap-2">
                                    <select
                                        value={ing.inventory_item_id}
                                        onChange={e => {
                                            const newIngs = [...ingredients];
                                            newIngs[idx].inventory_item_id = e.target.value;
                                            setIngredients(newIngs);
                                        }}
                                        className="flex-1 bg-white/[0.07] border border-white/20 rounded-lg px-3 py-2 text-xs text-white font-semibold outline-none focus:border-emerald-500"
                                    >
                                        <option value="">-- Select Material --</option>
                                        {materials.map(m => (
                                            <option key={m.id} value={m.id} className="bg-[#1e2229]">{m.name} ({m.unit_label})</option>
                                        ))}
                                    </select>
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
                                            placeholder="Usage Amount"
                                            className="w-full bg-white/[0.07] border border-white/20 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder:text-white/20 outline-none focus:border-emerald-500"
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
                <div className="flex items-center justify-between px-4 py-3 bg-white/[0.04] border border-white/10 rounded-xl">
                    <span className="text-sm font-semibold text-white/80">{t('available')}</span>
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
                        <span className={`text-sm font-bold w-20 ${isAvailable ? 'text-green-400' : 'text-white/40'}`}>
                            {isAvailable ? t('available') : t('unavailable')}
                        </span>
                    </label>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3.5 rounded-xl text-sm font-bold text-white/60 hover:text-white border border-white/15 hover:border-white/30 hover:bg-white/5 transition-all"
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
