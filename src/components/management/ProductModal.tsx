'use client';
import { useState, useEffect } from 'react';
import { Product, Category, createProduct, updateProduct } from '@/lib/tauri-commands';
import { Save, Package } from 'lucide-react';
import SidebarDrawer from './SidebarDrawer';

interface ProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    categories: Category[];
    product?: Product | null;
}

export default function ProductModal({ isOpen, onClose, onSave, categories, product }: ProductModalProps) {
    const [name, setName] = useState('');
    const [khmerName, setKhmerName] = useState('');
    const [priceCents, setPriceCents] = useState(0);
    const [stockQuantity, setStockQuantity] = useState(0);
    const [categoryId, setCategoryId] = useState('');
    const [isAvailable, setIsAvailable] = useState(true);
    const [imagePath, setImagePath] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (product) {
            setName(product.name);
            setKhmerName(product.khmer_name || '');
            setPriceCents(product.price_cents);
            setStockQuantity(product.stock_quantity);
            setCategoryId(product.category_id || '');
            setIsAvailable(product.is_available === 1);
            setImagePath(product.image_path || '');
        } else {
            setName('');
            setKhmerName('');
            setPriceCents(0);
            setStockQuantity(100);
            setCategoryId(categories[0]?.id || '');
            setIsAvailable(true);
            setImagePath('');
        }
    }, [product, categories, isOpen]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        try {
            if (product) {
                await updateProduct(
                    product.id, name, khmerName, priceCents, 
                    stockQuantity, categoryId, isAvailable, imagePath
                );
            } else {
                await createProduct(
                    categoryId, name, khmerName, priceCents, stockQuantity, imagePath
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
            title={product ? 'Edit Product' : 'New Product'}
            subtitle={product ? `Editing: ${product.name}` : 'Add a new item to the menu'}
        >
            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">Product Name (EN)</label>
                    <input
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full bg-[var(--background)] border border-[var(--border)] rounded-2xl px-5 py-3.5 text-[var(--foreground)] focus:border-[var(--accent)] outline-none transition-all font-bold placeholder:opacity-30"
                        placeholder="e.g. Fried Rice"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">Product Name (KH)</label>
                    <input
                        value={khmerName}
                        onChange={e => setKhmerName(e.target.value)}
                        className="w-full bg-[var(--background)] border border-[var(--border)] rounded-2xl px-5 py-3.5 text-[var(--foreground)] focus:border-[var(--accent)] outline-none transition-all khmer font-bold placeholder:opacity-30"
                        placeholder="បាយឆា"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">Price (Cents)</label>
                        <input
                            type="number"
                            required
                            value={priceCents}
                            onChange={e => setPriceCents(parseInt(e.target.value))}
                            className="w-full bg-[var(--background)] border border-[var(--border)] rounded-2xl px-5 py-3.5 text-[var(--foreground)] focus:border-[var(--accent)] outline-none transition-all font-black font-mono"
                        />
                        <p className="text-[10px] font-bold text-[var(--text-secondary)] mt-1 opacity-60 italic">100 cents = $1.00</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">Initial Stock</label>
                        <input
                            type="number"
                            required
                            value={stockQuantity}
                            onChange={e => setStockQuantity(parseInt(e.target.value))}
                            className="w-full bg-[var(--background)] border border-[var(--border)] rounded-2xl px-5 py-3.5 text-[var(--foreground)] focus:border-[var(--accent)] outline-none transition-all font-black font-mono"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">Category</label>
                    <select
                        value={categoryId}
                        onChange={e => setCategoryId(e.target.value)}
                        className="w-full bg-[var(--background)] border border-[var(--border)] rounded-2xl px-5 py-3.5 text-[var(--foreground)] focus:border-[var(--accent)] outline-none transition-all font-black appearance-none"
                    >
                        {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">Status</label>
                    <div className="flex items-center h-[54px] px-5 bg-[var(--background)] border border-[var(--border)] rounded-2xl">
                        <label className="flex items-center gap-3 cursor-pointer group w-full">
                            <input
                                type="checkbox"
                                checked={isAvailable}
                                onChange={e => setIsAvailable(e.target.checked)}
                                className="hidden"
                            />
                            <div className={`w-10 h-5 rounded-full relative transition-colors ${isAvailable ? 'bg-green-500' : 'bg-[var(--bg-elevated)] border border-[var(--border)]'}`}>
                                <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${isAvailable ? 'translate-x-5' : 'translate-x-0'} shadow-sm`} />
                            </div>
                            <span className={`text-sm font-black ${isAvailable ? 'text-green-400' : 'text-[var(--text-secondary)]'}`}>
                                {isAvailable ? 'Available' : 'Unavailable'}
                            </span>
                        </label>
                    </div>
                </div>

                <div className="flex items-center gap-3 pt-2 border-t border-white/5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 rounded-2xl text-sm font-black text-[var(--text-secondary)] hover:text-[var(--foreground)] border border-[var(--border)] hover:border-white/20 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 py-3 rounded-2xl bg-[var(--accent)] text-white font-black text-sm shadow-lg shadow-[var(--accent)]/30 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Save size={18} strokeWidth={3} />
                        )}
                        {product ? 'Commit Changes' : 'Add Product'}
                    </button>
                </div>
            </form>
        </SidebarDrawer>
    );
}


