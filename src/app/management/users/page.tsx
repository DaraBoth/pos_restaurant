'use client';
import { useState, useEffect } from 'react';
import { getUsers, deleteUser, UserSession } from '@/lib/tauri-commands';
import { useLanguage } from '@/providers/LanguageProvider';
import { Users as UsersIcon, Plus, ShieldCheck, Mail, CircleDot, Activity, Search, Edit3, Trash2, Shield } from 'lucide-react';
import UserModal from '@/components/management/UserModal';

export default function UsersManagement() {
    const [users, setUsers] = useState<UserSession[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<UserSession | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const { t, lang } = useLanguage();

    useEffect(() => {
        loadUsers();
    }, []);

    async function loadUsers() {
        try {
            const data = await getUsers();
            setUsers(data);
        } catch (e) {
            console.error(e);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Permanently remove this staff member? This cannot be undone.')) return;
        try {
            await deleteUser(id);
            loadUsers();
        } catch (e) {
            console.error(e);
            alert('Failed to delete user');
        }
    }

    const filteredUsers = users.filter(u => 
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.full_name && u.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="animate-fade-in space-y-4 pb-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-blue-500/15 border border-blue-500/30">
                        <UsersIcon size={16} className="text-blue-400" strokeWidth={2} />
                    </div>
                    <div>
                        <h1 className="text-base font-black text-[var(--foreground)] leading-none">
                            {t('users')}
                        </h1>
                        <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                            {lang === 'km' ? 'គ្រប់គ្រងបុគ្គលិក' : 'Manage staff access & roles'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                        <input
                            type="text"
                            placeholder={lang === 'km' ? 'ស្វែងរក...' : 'Search staff...'}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl pl-9 pr-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent-blue)] outline-none transition-all w-48"
                        />
                    </div>

                    <button
                        onClick={() => { setEditingUser(null); setIsModalOpen(true); }}
                        className="pos-btn-primary px-4 py-2 text-xs uppercase tracking-widest flex items-center gap-1.5 flex-shrink-0"
                    >
                        <Plus size={14} strokeWidth={2.5} />
                        {lang === 'km' ? 'បន្ថែម' : 'Add Staff'}
                    </button>
                </div>
            </div>

            {/* Data Grid */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
                <div className="overflow-x-auto container-snap">
                    <table className="w-full text-left whitespace-nowrap border-collapse">
                        <thead className="bg-[var(--bg-elevated)]">
                            <tr>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] border-b border-[var(--border)]">Identity</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] border-b border-[var(--border)]">Role</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] border-b border-[var(--border)]">Status</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] border-b border-[var(--border)] text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                            {filteredUsers.map(u => (
                                <tr key={u.id} className="transition-colors hover:bg-[var(--accent)]/5 group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center group-hover:border-[var(--accent-blue)]/30 transition-colors">
                                                <UsersIcon size={16} className="text-[var(--text-secondary)]" />
                                            </div>
                                            <div>
                                                <div className="font-black text-[var(--foreground)] text-sm tracking-tight">{u.username}</div>
                                                <div className="text-[10px] font-bold text-[var(--text-secondary)] flex items-center gap-1.5 mt-0.5">
                                                    {u.full_name || ''}
                                                    {u.khmer_name && <span className="text-[var(--accent-blue)]/60">·</span>}
                                                    <span className="khmer">{u.khmer_name}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border
                                            ${u.role === 'admin' ? 'bg-red-500/10 text-red-400 border-red-500/20' : ''}
                                            ${u.role === 'manager' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : ''}
                                            ${u.role === 'cashier' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : ''}
                                            ${u.role === 'waiter' ? 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border)]' : ''}
                                            ${u.role === 'chef' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : ''}
                                        `}>
                                            <Shield size={10} />
                                            {u.role}
                                        </span>
                                    </td>
                                    
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-black uppercase tracking-widest">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                            Active
                                        </span>
                                    </td>
                                    
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => { setEditingUser(u); setIsModalOpen(true); }}
                                                className="w-8 h-8 flex items-center justify-center rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] hover:bg-[var(--accent-blue)] hover:text-white text-[var(--text-secondary)] transition-all"
                                                title="Edit"
                                            >
                                                <Edit3 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(u.id)}
                                                className="w-8 h-8 flex items-center justify-center rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] hover:bg-red-500 hover:text-white text-[var(--text-secondary)] transition-all"
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredUsers.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-16 text-center">
                                        <UsersIcon size={32} className="mx-auto mb-3 text-[var(--text-secondary)] opacity-20" />
                                        <p className="text-[var(--text-secondary)] font-bold text-xs">{lang === 'km' ? 'រករាល់' : 'No staff found'}</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <UserModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={loadUsers}
                user={editingUser}
            />
        </div>
    );
}
