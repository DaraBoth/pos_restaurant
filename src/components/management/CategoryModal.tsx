'use client';
import { useState, useEffect } from 'react';
import { Category, createCategory, updateCategory } from '@/lib/tauri-commands';
import { Save } from 'lucide-react';
import SidebarDrawer from './SidebarDrawer';

interface CategoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    category?: Category | null;
}

export default function CategoryModal({ isOpen, onClose, onSave, category }: CategoryModalProps) {
    const [name, setName] = useState('');
    const [khmerName, setKhmerName] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (category) {
            setName(category.name);
            setKhmerName(category.khmer_name || '');
        } else {
            setName('');
            setKhmerName('');
        }
    }, [category, isOpen]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        try {
            if (category) {
                await updateCategory(category.id, name, khmerName);
            } else {
                await createCategory(name, khmerName);
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
                    <label className="text-xs font-bold uppercase tracking-widest text-[#8a8a99]">Category Name (EN)</label>
                    <input
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full bg-[#0f1115] border border-white/5 rounded-2xl px-5 py-3.5 text-white focus:border-[var(--accent)] outline-none transition-all font-medium"
                        placeholder="e.g. Beverages"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-[#8a8a99]">Category Name (KH)</label>
                    <input
                        value={khmerName}
                        onChange={e => setKhmerName(e.target.value)}
                        className="w-full bg-[#0f1115] border border-white/5 rounded-2xl px-5 py-3.5 text-white focus:border-[var(--accent)] outline-none transition-all khmer"
                        placeholder="ភេសជ្ជៈ"
                    />
                </div>

                <div className="flex items-center gap-3 pt-2 border-t border-white/5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 rounded-2xl text-sm font-bold text-[#8a8a99] hover:text-white border border-white/5 hover:border-white/20 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 py-3 rounded-2xl bg-[var(--accent)] text-black font-black text-sm shadow-lg shadow-[var(--accent)]/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
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


