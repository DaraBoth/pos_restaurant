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
    const { t } = useLanguage();

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
        <div className="max-w-7xl mx-auto animate-fade-in space-y-6">
            {/* Header Area */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-[#181a20] p-6 lg:p-8 rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-[100px] pointer-events-none" />
                
                <div className="flex items-center gap-6 relative z-10">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-blue-500/10 border border-blue-500/20 shadow-lg">
                        <UsersIcon size={32} className="text-blue-400" strokeWidth={2} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-white tracking-tight leading-none mb-2">Staff Directory</h1>
                        <p className="text-sm font-bold text-[#8a8a99] uppercase tracking-widest opacity-60">
                            Access Control & Team Management
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 relative z-10">
                    <div className="relative">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8a8a99]" />
                        <input 
                            type="text"
                            placeholder="Find a member..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="bg-[#0f1115] border border-white/5 rounded-2xl pl-12 pr-6 py-3 text-sm text-white focus:border-blue-500 outline-none transition-all w-full sm:w-64"
                        />
                    </div>
                    
                    <button
                        onClick={() => { setEditingUser(null); setIsModalOpen(true); }}
                        className="px-6 py-3 rounded-2xl bg-blue-600 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all"
                    >
                        <Plus size={18} strokeWidth={3} />
                        Register Staff
                    </button>
                </div>
            </div>

            {/* Data Grid */}
            <div className="bg-[#181a20] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl relative">
                <div className="overflow-x-auto container-snap">
                    <table className="w-full text-left whitespace-nowrap border-collapse">
                        <thead className="bg-[#0f1115]">
                            <tr>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#8a8a99] border-b border-white/5">Identity</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#8a8a99] border-b border-white/5">Role</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#8a8a99] border-b border-white/5">Status</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#8a8a99] border-b border-white/5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredUsers.map(u => (
                                <tr key={u.id} className="transition-colors hover:bg-white/[0.02] group">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-[#0f1115] border border-white/5 flex items-center justify-center group-hover:border-blue-500/30 transition-colors">
                                                <UsersIcon size={20} className="text-[#8a8a99]" />
                                            </div>
                                            <div>
                                                <div className="font-black text-white text-base tracking-tight">{u.username}</div>
                                                <div className="text-xs font-bold text-[#8a8a99] uppercase tracking-wider flex items-center gap-2 mt-0.5">
                                                    {u.full_name || 'No Name Set'}
                                                    {u.khmer_name && <span className="text-blue-500/60">•</span>}
                                                    <span className="khmer normal-case tracking-normal">{u.khmer_name}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    
                                    <td className="px-8 py-5">
                                        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border
                                            ${u.role === 'admin' ? 'bg-red-500/10 text-red-400 border-red-500/20' : ''}
                                            ${u.role === 'manager' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : ''}
                                            ${u.role === 'cashier' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : ''}
                                            ${u.role === 'waiter' ? 'bg-[#0f1115] text-[#8a8a99] border-white/5' : ''}
                                        `}>
                                            <Shield size={12} />
                                            {u.role}
                                        </span>
                                    </td>
                                    
                                    <td className="px-8 py-5">
                                        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-black uppercase tracking-widest">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                            Authorized
                                        </span>
                                    </td>
                                    
                                    <td className="px-8 py-5 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => { setEditingUser(u); setIsModalOpen(true); }}
                                                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-blue-600 text-white transition-all shadow-lg"
                                                title="Edit Details"
                                            >
                                                <Edit3 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(u.id)}
                                                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-red-500 text-white transition-all shadow-lg"
                                                title="Revoke Access"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredUsers.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-8 py-20 text-center">
                                        <UsersIcon size={48} className="mx-auto mb-4 text-[#8a8a99] opacity-20" />
                                        <p className="text-[#8a8a99] font-black uppercase tracking-widest text-xs">No personnel found</p>
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
