'use client';
import { useState, useEffect } from 'react';
import { getCategories, deleteCategory, Category } from '@/lib/tauri-commands';
import { Layers, Plus, Trash2, Edit3, Search } from 'lucide-react';
import CategoryModal from '@/components/management/CategoryModal';
import { useLanguage } from '@/providers/LanguageProvider';
import { useAuth } from '@/providers/AuthProvider';

export default function CategoriesManagement() {
    const { t } = useLanguage();
    const { user } = useAuth();
    const [categories, setCategories] = useState<Category[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            const cats = await getCategories(user?.restaurant_id || undefined);
            setCategories(cats);
        } catch (e) {
            console.error(e);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Are you sure you want to delete this category? All products in this category will become unassigned.')) return;
        try {
            await deleteCategory(id, user?.restaurant_id || '');
            loadData();
        } catch (e) {
            console.error(e);
            alert('Failed to delete category');
        }
    }

    const filtered = categories.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.khmer_name && c.khmer_name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="animate-fade-in space-y-3 pb-6">
            {/* Header — matches Products page style */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[var(--accent)]/15 border border-[var(--accent)]/30">
                        <Layers size={14} className="text-[var(--accent)]" />
                    </div>
                    <div>
                        <h1 className="text-sm font-black text-[var(--foreground)] leading-none">
                            {t('category')}
                        </h1>
                        <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 font-semibold uppercase tracking-widest">
                            {filtered.length} {t('category')}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                        <input
                            type="text"
                            placeholder={t('searchItems')}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[var(--foreground)] placeholder:text-[var(--text-secondary)] outline-none focus:border-[var(--accent)] transition-colors w-36"
                        />
                    </div>
                    <button
                        onClick={() => { setEditingCategory(null); setIsModalOpen(true); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-bold hover:brightness-110 active:scale-95 transition-all"
                    >
                        <Plus size={13} strokeWidth={3} />
                        Add
                    </button>
                </div>
            </div>

            {/* Category grid */}
            {filtered.length === 0 ? (
                <div className="pos-card p-10 text-center">
                    <Layers size={32} className="mx-auto mb-3 text-[var(--text-secondary)] opacity-30" />
                    <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                        No categories found
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {filtered.map(cat => (
                        <div
                            key={cat.id}
                            className="pos-card p-4 group hover:border-[var(--accent)]/40 transition-all relative"
                        >
                            {/* Action buttons — visible on hover */}
                            <div className="absolute top-2.5 right-2.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => { setEditingCategory(cat); setIsModalOpen(true); }}
                                    className="w-6 h-6 flex items-center justify-center rounded-md bg-[var(--bg-elevated)] hover:bg-[var(--accent)] hover:text-white text-[var(--text-secondary)] transition-all"
                                >
                                    <Edit3 size={11} />
                                </button>
                                <button
                                    onClick={() => handleDelete(cat.id)}
                                    className="w-6 h-6 flex items-center justify-center rounded-md bg-[var(--bg-elevated)] hover:bg-red-500 hover:text-white text-[var(--text-secondary)] transition-all"
                                >
                                    <Trash2 size={11} />
                                </button>
                            </div>

                            {/* Icon */}
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--accent)]/10 border border-[var(--accent)]/20 mb-3 group-hover:bg-[var(--accent)]/20 transition-colors">
                                <Layers size={15} className="text-[var(--accent)]" />
                            </div>

                            {/* Name */}
                            <p className="text-sm font-black text-[var(--foreground)] leading-tight truncate pr-8">
                                {cat.name}
                            </p>
                            <p className="text-[11px] text-[var(--text-secondary)] khmer mt-0.5 truncate">
                                {cat.khmer_name || '—'}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            <CategoryModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={loadData}
                category={editingCategory}
            />
        </div>
    );
}
