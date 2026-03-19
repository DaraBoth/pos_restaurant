'use client';
import { useState, useEffect } from 'react';
import { Trash2, Plus, LayoutGrid, Users2 } from 'lucide-react';
import { getTables, createTable, deleteTable, getOrders } from '@/lib/tauri-commands';
import type { FloorTable, Order } from '@/types';
import { useLanguage } from '@/providers/LanguageProvider';

export default function TablesManagementPage() {
    const { lang } = useLanguage();
    const [tables, setTables] = useState<FloorTable[]>([]);
    const [busyTableIds, setBusyTableIds] = useState<Set<string>>(new Set());
    const [newName, setNewName] = useState('');
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => { load(); }, []);

    async function load() {
        setLoading(true);
        try {
            const [dbTables, openOrders]: [FloorTable[], Order[]] = await Promise.all([
                getTables(),
                getOrders('open'),
            ]);
            setTables(dbTables);
            const busy = new Set<string>();
            openOrders.forEach(o => { if (o.table_id) busy.add(o.table_id); });
            setBusyTableIds(busy);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function handleCreate() {
        const name = newName.trim().toUpperCase();
        if (!name) return;
        if (tables.some(t => t.name === name)) {
            setError(lang === 'km' ? 'ឈ្មោះតុនេះមានរួចហើយ' : 'A table with that name already exists.');
            return;
        }
        setCreating(true);
        setError('');
        try {
            await createTable(name);
            setNewName('');
            await load();
        } catch (e) {
            setError(lang === 'km' ? 'បរាជ័យក្នុងការបន្ថែមតុ' : 'Failed to create table.');
            console.error(e);
        } finally {
            setCreating(false);
        }
    }

    async function handleDelete(table: FloorTable) {
        if (busyTableIds.has(table.name)) {
            setError(lang === 'km'
                ? `តុ ${table.name} មានការបញ្ជាទិញសកម្ម មិនអាចលុបបានទេ`
                : `Table ${table.name} has an active order and cannot be deleted.`);
            return;
        }
        try {
            await deleteTable(table.id);
            await load();
        } catch (e) {
            setError(lang === 'km' ? 'បរាជ័យក្នុងការលុបតុ' : 'Failed to delete table.');
            console.error(e);
        }
    }

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--accent-blue)]/15 border border-[var(--accent-blue)]/30">
                    <LayoutGrid size={18} className="text-[var(--accent-blue)]" />
                </div>
                <div>
                    <h1 className="text-lg font-black text-[var(--foreground)] leading-none">
                        {lang === 'km' ? 'គ្រប់គ្រងតុ' : 'Table Management'}
                    </h1>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        {lang === 'km' ? 'បន្ថែម ឬ លុបតុ' : 'Add and remove tables from the floor plan'}
                    </p>
                </div>
            </div>

            {/* Add table card */}
            <div className="pos-card p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-3">
                    {lang === 'km' ? 'បន្ថែមតុថ្មី' : 'Add New Table'}
                </p>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newName}
                        onChange={e => { setNewName(e.target.value.toUpperCase()); setError(''); }}
                        onKeyDown={e => e.key === 'Enter' && handleCreate()}
                        placeholder={lang === 'km' ? 'ឈ្មោះតុ (ឧ. A1)' : 'Table name (e.g. A1)'}
                        maxLength={10}
                        className="flex-1 px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-sm font-bold uppercase text-[var(--foreground)] placeholder-[var(--text-secondary)]/40 outline-none focus:border-[var(--accent-blue)] transition-colors"
                    />
                    <button
                        onClick={handleCreate}
                        disabled={!newName.trim() || creating}
                        className="pos-btn-primary px-4 py-2 text-xs uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-40"
                    >
                        <Plus size={14} strokeWidth={2.5} />
                        {lang === 'km' ? 'បន្ថែម' : 'Add'}
                    </button>
                </div>
                {error && (
                    <p className="mt-2 text-xs text-red-400">{error}</p>
                )}
            </div>

            {/* Table list */}
            <div className="pos-card overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                        {lang === 'km' ? 'តុទាំងអស់' : 'All Tables'}
                    </p>
                    <span className="text-xs text-[var(--text-secondary)]">{tables.length}</span>
                </div>

                {loading ? (
                    <div className="p-4 space-y-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-10 rounded-xl animate-pulse bg-[var(--bg-elevated)]" />
                        ))}
                    </div>
                ) : tables.length === 0 ? (
                    <div className="py-12 flex flex-col items-center gap-2 opacity-40">
                        <LayoutGrid size={32} className="text-[var(--text-secondary)]" />
                        <p className="text-sm text-[var(--text-secondary)]">
                            {lang === 'km' ? 'មិនទាន់មានតុ' : 'No tables yet'}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-[var(--border)]">
                        {tables.map(table => {
                            const isBusy = busyTableIds.has(table.name);
                            return (
                                <div key={table.id} className="flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-elevated)] transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                                            isBusy
                                                ? 'bg-blue-500/12 border-blue-500/40'
                                                : 'bg-green-500/10 border-green-500/30'
                                        }`}>
                                            {isBusy
                                                ? <Users2 size={14} className="text-blue-400" />
                                                : <LayoutGrid size={14} className="text-green-400" />
                                            }
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-[var(--foreground)]">{table.name}</p>
                                            <p className={`text-[10px] font-semibold ${isBusy ? 'text-blue-400' : 'text-green-400'}`}>
                                                {isBusy
                                                    ? (lang === 'km' ? 'មានភ្ញៀវ' : 'Occupied')
                                                    : (lang === 'km' ? 'ទំនេរ' : 'Free')}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(table)}
                                        disabled={isBusy}
                                        title={isBusy
                                            ? (lang === 'km' ? 'មិនអាចលុបតុដែលមានភ្ញៀវ' : 'Cannot delete occupied table')
                                            : (lang === 'km' ? 'លុបតុ' : 'Delete table')}
                                        className="p-1.5 rounded-lg transition-all hover:bg-red-500/10 text-red-500/50 hover:text-red-400 disabled:opacity-20 disabled:cursor-not-allowed"
                                    >
                                        <Trash2 size={14} strokeWidth={2} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
