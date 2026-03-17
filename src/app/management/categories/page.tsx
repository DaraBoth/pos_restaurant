'use client';
import { useState, useEffect } from 'react';
import { getCategories, deleteCategory, Category } from '@/lib/tauri-commands';
import { Layers, Plus, Trash2, Edit3, Search, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import CategoryModal from '@/components/management/CategoryModal';

export default function CategoriesManagement() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            const cats = await getCategories();
            setCategories(cats);
        } catch (e) {
            console.error(e);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Are you sure you want to delete this category? All products in this category will become unassigned.')) return;
        try {
            await deleteCategory(id);
            loadData();
        } catch (e) {
            console.error(e);
            alert('Failed to delete category');
        }
    }

    const filteredCategories = categories.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.khmer_name && c.khmer_name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="max-w-4xl mx-auto animate-fade-in space-y-6">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-[#181a20] p-6 lg:p-8 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-[var(--accent)]/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-[80px] pointer-events-none" />
                
                <div className="flex items-center gap-6 relative z-10">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-[var(--accent)]/10 border border-[var(--accent)]/20 shadow-lg">
                        <Layers size={28} className="text-[var(--accent)]" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white tracking-tight">Catalog Groups</h1>
                        <p className="text-xs font-bold text-[#8a8a99] uppercase tracking-[0.2em] opacity-60">Classification & Structure</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 relative z-10">
                    <div className="relative">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8a8a99]" />
                        <input 
                            type="text"
                            placeholder="Search categories..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="bg-[#0f1115] border border-white/5 rounded-2xl pl-12 pr-6 py-2.5 text-sm text-white focus:border-[var(--accent)] outline-none transition-all w-full sm:w-48"
                        />
                    </div>
                    
                    <button
                        onClick={() => { setEditingCategory(null); setIsModalOpen(true); }}
                        className="px-6 py-2.5 rounded-2xl bg-[var(--accent)] text-black font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-[var(--accent)]/20 hover:scale-105 active:scale-95 transition-all"
                    >
                        <Plus size={18} strokeWidth={3} />
                        Add Group
                    </button>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCategories.map(cat => (
                    <div key={cat.id} className="bg-[#181a20] p-6 rounded-3xl border border-white/5 group hover:border-[var(--accent)]/30 transition-all relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => { setEditingCategory(cat); setIsModalOpen(true); }}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-[var(--accent)] hover:text-black text-[#8a8a99] transition-all"
                            >
                                <Edit3 size={14} />
                            </button>
                            <button
                                onClick={() => handleDelete(cat.id)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-red-500 text-white text-[#8a8a99] transition-all"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                        
                        <div className="w-10 h-10 rounded-xl bg-[#0f1115] flex items-center justify-center mb-4 border border-white/5 group-hover:border-[var(--accent)]/30 transition-colors">
                            <Layers size={18} className="text-[var(--accent)]" />
                        </div>
                        
                        <h3 className="text-lg font-black text-white mb-1">{cat.name}</h3>
                        <p className="text-sm font-bold text-[#8a8a99] khmer">{cat.khmer_name || '---'}</p>
                    </div>
                ))}
            </div>

            {filteredCategories.length === 0 && (
                <div className="py-20 text-center bg-[#181a20] rounded-[2.5rem] border border-white/5">
                    <Layers size={48} className="mx-auto mb-4 text-[#8a8a99] opacity-20" />
                    <p className="text-[#8a8a99] font-bold uppercase tracking-widest text-xs">No categories found</p>
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
