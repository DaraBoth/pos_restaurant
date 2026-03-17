'use client';
import { useState, useEffect } from 'react';
import { getUsers, createUser, UserSession } from '@/lib/tauri-commands';
import { useLanguage } from '@/contexts/LanguageContext';
import { Users as UsersIcon, Plus, ShieldCheck, Mail, CircleDot, Activity } from 'lucide-react';

export default function UsersManagement() {
    const [users, setUsers] = useState<UserSession[]>([]);
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

    async function handleAddAdmin() {
        try {
            await createUser(`manager_${Math.floor(Math.random() * 1000)}`, 'password', 'manager');
            loadUsers();
        } catch (e) {
            console.error(e);
            alert(t('error'));
        }
    }

    return (
        <div className="max-w-7xl mx-auto animate-fade-in space-y-6">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-[#181a20] p-6 rounded-2xl border border-white/5 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#3b82f6]/10">
                        <UsersIcon size={24} className="text-[#3b82f6]" strokeWidth={2} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-1">Staff Access</h1>
                        <p className="text-sm font-medium text-[var(--text-secondary)]">
                            Manage user accounts, roles, and security
                        </p>
                    </div>
                </div>

                <div className="flex gap-4">
                    {/* Stats Pill */}
                    <div className="px-5 py-2.5 rounded-xl bg-[#0f1115] border border-white/5 flex items-center gap-4">
                        <div className="text-center">
                            <span className="block text-xl font-bold font-mono text-white leading-none">{users.length}</span>
                            <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Total Staff</span>
                        </div>
                        <div className="w-px h-6 bg-white/10" />
                        <div className="flex items-center gap-2">
                            <ShieldCheck size={16} className="text-[#3b82f6]" />
                            <span className="text-xs font-semibold uppercase tracking-wider text-[#3b82f6]">Secure</span>
                        </div>
                    </div>

                    <button
                        onClick={handleAddAdmin}
                        className="btn-primary px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2"
                        style={{ background: '#3b82f6', color: 'white', border: '1px solid #3b82f6' }}
                    >
                        <Plus size={16} />
                        Add Staff
                    </button>
                </div>
            </div>

            {/* Data Grid */}
            <div className="bg-[#181a20] border border-white/5 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto container-snap">
                    <table className="w-full text-left whitespace-nowrap">
                        <thead className="bg-[#0f1115]">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] border-b border-white/5">Profile</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] border-b border-white/5">Access Level</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] border-b border-white/5">Status</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] border-b border-white/5">Activity</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {users.map(u => (
                                <tr key={u.id} className="transition-colors hover:bg-white/[0.02] group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-[#0f1115] border border-white/5 flex items-center justify-center text-[var(--text-secondary)] group-hover:bg-[#3b82f6]/10 group-hover:text-[#3b82f6] transition-colors">
                                                <UsersIcon size={16} />
                                            </div>
                                            <div>
                                                <div className="font-semibold text-white text-sm flex items-center gap-2">
                                                    {u.username}
                                                </div>
                                                <div className="text-xs font-medium text-[var(--text-secondary)] flex items-center gap-1 mt-0.5">
                                                    <Mail size={12} />
                                                    {u.username}@khpos.local
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border
                                            ${u.role === 'admin' ? 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20' : ''}
                                            ${u.role === 'manager' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : ''}
                                            ${u.role === 'cashier' ? 'bg-[#0f1115] text-[var(--text-secondary)] border-white/5' : ''}
                                        `}>
                                            {u.role === 'admin' && <ShieldCheck size={14} />}
                                            {u.role === 'manager' && <Activity size={14} />}
                                            {u.role === 'cashier' && <CircleDot size={14} />}
                                            {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                                        </span>
                                    </td>
                                    
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold tracking-wide">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                            Active
                                        </span>
                                    </td>
                                    
                                    <td className="px-6 py-4">
                                        <div className="text-xs font-mono font-medium text-[var(--text-secondary)]">
                                            Last login: Just now
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
