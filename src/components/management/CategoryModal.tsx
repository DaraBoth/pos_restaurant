'use client';
import { useState, useEffect } from 'react';
import { createCategory, updateCategory } from '@/lib/api/products';
import type { Category } from '@/types';
import { useAuth } from '@/providers/AuthProvider';
import { Save, ChevronDown, Check } from 'lucide-react';
import SidebarDrawer from './SidebarDrawer';

interface CategoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    category?: Category | null;
    allCategories?: Category[];
}

export default function CategoryModal({ isOpen, onClose, onSave, category, allCategories = [] }: CategoryModalProps) {
    const [name, setName] = useState('');
    const [khmerName, setKhmerName] = useState('');
    const [parentId, setParentId] = useState('');
    const [parentSearch, setParentSearch] = useState('');
    const [isParentPickerOpen, setIsParentPickerOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();
    const restaurantId = user?.restaurant_id;

    useEffect(() => {
        if (category) {
            setName(category.name);
            setKhmerName(category.khmer_name || '');
            setParentId(category.parent_id || '');
        } else {
            setName('');
            setKhmerName('');
            setParentId('');
        }
        setParentSearch('');
        setIsParentPickerOpen(false);
    }, [category, isOpen]);

    const selectedParent = allCategories.find(c => c.id === parentId);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        try {
            if (category) {
                await updateCategory(category.id, name, khmerName, parentId || undefined, restaurantId || '');
            } else {
                await createCategory(name, khmerName, parentId || undefined, restaurantId || undefined);
            }
            onSave();
            onClose();
        } catch (error) {
            console.error(error);
            alert('Failed to save category');
        } finally {
            setLoading(false);
        }
    }

    return (
        <SidebarDrawer
            isOpen={isOpen}
            onClose={onClose}
            title={category ? 'Edit Category' : 'New Category'}
            subtitle={category ? `Editing: ${category.name}` : 'Create a menu category'}
        >
            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">Category Name (EN)</label>
                    <input
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--foreground)] placeholder:text-[var(--text-secondary)]/50 focus:border-[var(--accent)] outline-none transition-all font-medium"
                        placeholder="e.g. Beverages"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">Category Name (KH)</label>
                    <input
                        value={khmerName}
                        onChange={e => setKhmerName(e.target.value)}
                        className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--foreground)] placeholder:text-[var(--text-secondary)]/50 focus:border-[var(--accent)] outline-none transition-all khmer"
                        placeholder="ភេសជ្ជៈ"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">Parent Category</label>
                    <button
                        type="button"
                        onClick={() => setIsParentPickerOpen(prev => !prev)}
                        className="w-full flex items-center justify-between bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--foreground)] text-sm font-semibold hover:border-[var(--accent)]/40 transition-colors"
                    >
                        <span className="truncate text-left">
                            {selectedParent ? selectedParent.name : '— None (top-level category) —'}
                        </span>
                        <ChevronDown size={16} className={`text-[var(--text-secondary)] transition-transform ${isParentPickerOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isParentPickerOpen && (
                        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-2 space-y-2">
                            <input
                                value={parentSearch}
                                onChange={e => setParentSearch(e.target.value)}
                                placeholder="Search parent category"
                                className="w-full bg-[var(--bg-dark)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--foreground)] text-sm placeholder:text-[var(--text-secondary)]/60 focus:border-[var(--accent)] outline-none transition-all"
                            />
                            <div className="max-h-44 overflow-y-auto rounded-lg border border-[var(--border)]">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setParentId('');
                                        setIsParentPickerOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between text-left px-3 py-2.5 text-sm font-semibold border-b border-[var(--border)] transition-colors ${
                                        parentId === ''
                                            ? 'bg-[var(--accent)]/15 text-[var(--foreground)]'
                                            : 'text-[var(--foreground)] hover:bg-[var(--bg-dark)]'
                                    }`}
                                >
                                    <span>— None (top-level category) —</span>
                                    {parentId === '' && <Check size={14} className="text-[var(--accent)]" />}
                                </button>

                                {allCategories
                                    .filter(c => c.id !== category?.id)
                                    .filter(c => {
                                        const q = parentSearch.trim().toLowerCase();
                                        if (!q) return true;
                                        return c.name.toLowerCase().includes(q) || (c.khmer_name || '').toLowerCase().includes(q);
                                    })
                                    .map(c => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            onClick={() => {
                                                setParentId(c.id);
                                                setIsParentPickerOpen(false);
                                            }}
                                            className={`w-full flex items-center justify-between text-left py-2 pr-3 text-sm transition-colors ${
                                                parentId === c.id
                                                    ? 'bg-[var(--accent)]/15 text-[var(--foreground)] font-semibold'
                                                    : 'text-[var(--foreground)] hover:bg-[var(--bg-dark)]'
                                            }`}
                                            style={{ paddingLeft: `${12 + (c.depth || 0) * 18}px` }}
                                        >
                                            <span>{(c.depth || 0) > 0 ? '└ ' : ''}{c.name}</span>
                                            {parentId === c.id && <Check size={14} className="text-[var(--accent)]" />}
                                        </button>
                                    ))}
                            </div>
                        </div>
                    )}
                    <p className="text-[10px] text-[var(--text-secondary)]">Assign this as a sub-category of another category.</p>
                </div>

                <div className="flex items-center gap-3 pt-2 border-t border-[var(--border)]">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--bg-elevated)] transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 py-3 rounded-xl bg-[var(--accent)] text-white font-black text-sm shadow-lg shadow-[var(--accent)]/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        ) : (
                            <Save size={18} />
                        )}
                        {category ? 'Save Changes' : 'Create Category'}
                    </button>
                </div>
            </form>
        </SidebarDrawer>
    );
}


