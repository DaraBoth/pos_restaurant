'use client';
import { useState, useEffect, useRef } from 'react';
import { createProduct, updateProduct } from '@/lib/api/products';
import type { Product, Category, InventoryItem } from '@/types';
import { useLanguage } from '@/providers/LanguageProvider';
import { useAuth } from '@/providers/AuthProvider';
import { Save, ImagePlus, X, Box } from 'lucide-react';
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
    const [stockQuantity, setStockQuantity] = useState(0);
    const [categoryId, setCategoryId] = useState('');
    const [isAvailable, setIsAvailable] = useState(true);
    const [imagePath, setImagePath] = useState('');
    const [loading, setLoading] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Inventory Link State
    const [materials, setMaterials] = useState<InventoryItem[]>([]);
    const [inventoryItemId, setInventoryItemId] = useState('');
    const [inventoryItemUsage, setInventoryItemUsage] = useState(1);

    useEffect(() => {
        if (product) {
            setName(product.name);
            setKhmerName(product.khmer_name || '');
            setPriceUsd((product.price_cents / 100).toFixed(2));
            setStockQuantity(product.stock_quantity);
            setCategoryId(product.category_id || '');
            setIsAvailable(product.is_available === 1);
            setImagePath(product.image_path || '');
            setInventoryItemId(product.inventory_item_id || '');
            setInventoryItemUsage(product.inventory_item_usage || 1);
        } else {
            setName('');
            setKhmerName('');
            setPriceUsd('0.00');
            setStockQuantity(100);
            setCategoryId(categories[0]?.id || '');
            setIsAvailable(true);
            setImagePath('');
            setInventoryItemId('');
            setInventoryItemUsage(1);
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
                    stockQuantity, categoryId, isAvailable, imagePath || undefined,
                    inventoryItemId || undefined, inventoryItemUsage,
                    restaurantId || ''
                );
            } else {
                await createProduct(
                    categoryId, name, khmerName, priceCents, stockQuantity, imagePath, 
                    inventoryItemId || undefined, inventoryItemUsage,
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
                <div className="grid grid-cols-2 gap-3">
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
                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">
                            {t('inventory')}
                        </label>
                        <input
                            type="number"
                            required
                            min="0"
                            value={stockQuantity}
                            onChange={e => setStockQuantity(parseInt(e.target.value) || 0)}
                            className="w-full bg-white/[0.07] border border-white/20 rounded-xl px-4 py-3 text-white font-mono font-bold focus:border-[var(--accent)] focus:bg-white/[0.09] outline-none transition-all"
                        />
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
                    <div className="flex items-center gap-2 mb-1">
                        <Box size={14} className="text-emerald-400" />
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Inventory Integration</h3>
                    </div>
                    
                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">
                            Link to Stock Item
                        </label>
                        <select
                            value={inventoryItemId}
                            onChange={e => setInventoryItemId(e.target.value)}
                            className="w-full bg-white/[0.07] border border-white/20 rounded-xl px-4 py-3 text-white font-semibold focus:border-emerald-500 focus:bg-white/[0.09] outline-none transition-all appearance-none cursor-pointer"
                        >
                            <option value="" className="bg-[#1e2229] text-white/50">-- Not linked to inventory --</option>
                            {materials.map(m => (
                                <option key={m.id} value={m.id} className="bg-[#1e2229] text-white">{m.name} ({m.unit_label})</option>
                            ))}
                        </select>
                    </div>

                    {inventoryItemId && (
                        <div className="space-y-1.5 pt-1 animate-in fade-in slide-in-from-top-1 duration-300">
                            <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">
                                Usage per sale (Qty)
                            </label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.001"
                                    value={inventoryItemUsage}
                                    onChange={e => setInventoryItemUsage(parseFloat(e.target.value) || 0)}
                                    className="flex-1 bg-white/[0.07] border border-white/20 rounded-xl px-4 py-3 text-white font-mono font-bold focus:border-emerald-500 outline-none transition-all"
                                />
                                <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
                                    {materials.find(m => m.id === inventoryItemId)?.unit_label}
                                </span>
                            </div>
                            <p className="text-[10px] text-white/40 italic">
                                e.g. 1 (piece), 0.5 (kg), 250 (ml)
                            </p>
                        </div>
                    )}
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
