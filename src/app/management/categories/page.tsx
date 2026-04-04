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

    const categoryRows = searchQuery.trim() ? filtered : categories;

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

            {/* Category tree list */}
            {filtered.length === 0 ? (
                <div className="pos-card p-10 text-center">
                    <Layers size={32} className="mx-auto mb-3 text-[var(--text-secondary)] opacity-30" />
                    <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                        No categories found
                    </p>
                </div>
            ) : (
                <div className="pos-card overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-[var(--border)] bg-[var(--bg-elevated)] flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                        <span>Category Tree</span>
                        <span>{categoryRows.length} items</span>
                    </div>
                    <div className="divide-y divide-[var(--border)]">
                        {categoryRows.map(cat => {
                            const depth = cat.depth || 0;
                            const childrenCount = categories.filter(c => c.parent_id === cat.id).length;

                            return (
                                <div key={cat.id} className="group px-4 py-3 hover:bg-[var(--bg-elevated)]/60 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="flex items-center gap-2 min-w-0 flex-1"
                                            style={{ paddingLeft: `${depth * 22}px` }}
                                        >
                                            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex-shrink-0">
                                                <Layers size={13} className="text-[var(--accent)]" />
                                            </div>

                                            {depth > 0 && <span className="text-[var(--text-secondary)] text-xs select-none">└</span>}

                                            <div className="min-w-0">
                                                <p className="text-sm font-black text-[var(--foreground)] leading-tight truncate">
                                                    {cat.name}
                                                </p>
                                                <p className="text-[11px] text-[var(--text-secondary)] khmer mt-0.5 truncate">
                                                    {cat.khmer_name || '—'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="hidden sm:flex items-center gap-1.5">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border border-[var(--border)] text-[var(--text-secondary)] bg-[var(--bg-dark)]">
                                                {depth === 0 ? 'Main' : `Level ${depth + 1}`}
                                            </span>
                                            {childrenCount > 0 && (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border border-[var(--accent)]/30 text-[var(--accent)] bg-[var(--accent)]/10">
                                                    {childrenCount} sub
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => { setEditingCategory(cat); setIsModalOpen(true); }}
                                                className="w-7 h-7 flex items-center justify-center rounded-md bg-[var(--bg-elevated)] hover:bg-[var(--accent)] hover:text-white text-[var(--text-secondary)] transition-all"
                                            >
                                                <Edit3 size={12} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(cat.id)}
                                                className="w-7 h-7 flex items-center justify-center rounded-md bg-[var(--bg-elevated)] hover:bg-red-500 hover:text-white text-[var(--text-secondary)] transition-all"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <CategoryModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={loadData}
                category={editingCategory}
                allCategories={categories}
            />
        </div>
    );
}
