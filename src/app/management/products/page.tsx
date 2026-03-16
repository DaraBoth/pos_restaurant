'use client';
import { useState, useEffect } from 'react';
import { getProducts, getCategories, createProduct, updateProduct, deleteProduct, Product, Category } from '@/lib/tauri-commands';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatUsd } from '@/lib/currency';

export default function ProductsManagement() {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const { t, lang } = useLanguage();

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            const [cats, prods] = await Promise.all([getCategories(), getProducts()]);
            setCategories(cats);
            setProducts(prods);
        } catch (e) {
            console.error(e);
        }
    }

    // Very basic implementations for demo purposes. Real app would have full forms.
    async function handleAddDemo() {
        try {
            if (categories.length === 0) return alert('Needs a category first');
            await createProduct(
                categories[0].id,
                'New Demo Item',
                'មុខម្ហូបថ្មី',
                250
            );
            loadData();
        } catch (e) {
            console.error(e);
            alert(t('error'));
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Are you sure you want to delete this product?')) return;
        try {
            await deleteProduct(id);
            loadData();
        } catch (e) {
            console.error(e);
            alert(t('error'));
        }
    }

    return (
        <div className="max-w-6xl mx-auto auto-fade-in relative z-10 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Products Management</h1>
                <button onClick={handleAddDemo} className="btn-primary px-4 py-2 rounded-xl font-bold">
                    + Add Demo Product
                </button>
            </div>

            <div className="glass rounded-2xl border border-[var(--border)] overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-[var(--bg-dark)] border-b border-[var(--border)]">
                        <tr>
                            <th className="px-6 py-4 text-sm font-semibold text-[var(--text-secondary)]">Name (EN/KH)</th>
                            <th className="px-6 py-4 text-sm font-semibold text-[var(--text-secondary)]">Category</th>
                            <th className="px-6 py-4 text-sm font-semibold text-[var(--text-secondary)]">Price</th>
                            <th className="px-6 py-4 text-sm font-semibold text-[var(--text-secondary)] text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                        {products.map(p => (
                            <tr key={p.id} className="hover:bg-[var(--bg-elevated)] transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-medium text-white">{p.name}</div>
                                    <div className="text-sm text-[var(--text-secondary)] khmer">{p.khmer_name}</div>
                                </td>
                                <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">
                                    {p.category_name}
                                </td>
                                <td className="px-6 py-4 font-mono font-bold text-[var(--accent)]">
                                    {formatUsd(p.price_cents)}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button onClick={() => handleDelete(p.id)} className="text-red-400 hover:text-red-300 text-sm font-semibold transition-colors">
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {products.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-[var(--text-secondary)]">
                                    No products found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
