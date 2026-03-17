'use client';
import { useState, useEffect } from 'react';
import { Category, createCategory, updateCategory } from '@/lib/tauri-commands';
import { X, Save, Layers } from 'lucide-react';

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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#181a20] border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
                <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-[#0f1115]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
                            <Layers size={20} className="text-[var(--accent)]" />
                        </div>
                        <h2 className="text-xl font-bold text-white">
                            {category ? 'Edit Category' : 'New Category'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 text-[#8a8a99] transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-[#8a8a99] ml-1">Category Name (EN)</label>
                            <input
                                required
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full bg-[#0f1115] border border-white/5 rounded-2xl px-5 py-3.5 text-white focus:border-[var(--accent)] outline-none transition-all font-medium"
                                placeholder="e.g. Beverages"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-[#8a8a99] ml-1">Category Name (KH)</label>
                            <input
                                value={khmerName}
                                onChange={e => setKhmerName(e.target.value)}
                                className="w-full bg-[#0f1115] border border-white/5 rounded-2xl px-5 py-3.5 text-white focus:border-[var(--accent)] outline-none transition-all khmer"
                                placeholder="ភេសជ្ជៈ"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-4 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 rounded-2xl text-sm font-bold text-[#8a8a99] hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-8 py-3 rounded-2xl bg-[var(--accent)] text-black font-black text-sm shadow-lg shadow-[var(--accent)]/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
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
            </div>
        </div>
    );
}
