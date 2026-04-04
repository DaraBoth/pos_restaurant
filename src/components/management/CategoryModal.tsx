'use client';
import { useState, useEffect } from 'react';
import { createCategory, updateCategory } from '@/lib/api/products';
import type { Category } from '@/types';
import { useAuth } from '@/providers/AuthProvider';
import { Save } from 'lucide-react';
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
    }, [category, isOpen]);

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
                    <select
                        value={parentId}
                        onChange={e => setParentId(e.target.value)}
                        className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--foreground)] font-semibold focus:border-[var(--accent)] outline-none transition-all appearance-none cursor-pointer"
                    >
                        <option value="">— None (top-level category) —</option>
                        {allCategories
                            .filter(c => c.id !== category?.id)
                            .map(c => (
                                <option key={c.id} value={c.id} className="bg-[var(--bg-elevated)] text-[var(--foreground)]">
                                    {'\u00a0\u00a0\u00a0'.repeat(c.depth || 0)}{(c.depth || 0) > 0 ? '└ ' : ''}{c.name}
                                </option>
                            ))
                        }
                    </select>
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


