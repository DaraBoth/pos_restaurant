'use client';
import { useState, useEffect } from 'react';
import { getUsers, createUser, UserSession } from '@/lib/tauri-commands';
import { useLanguage } from '@/contexts/LanguageContext';

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
            await createUser('newadmin', 'password', 'manager');
            loadUsers();
        } catch (e) {
            console.error(e);
            alert(t('error'));
        }
    }

    return (
        <div className="max-w-5xl mx-auto auto-fade-in relative z-10 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Users & Roles</h1>
                <button onClick={handleAddAdmin} className="btn-primary px-4 py-2 rounded-xl font-bold">
                    + Add Demo Admin
                </button>
            </div>

            <div className="glass rounded-2xl border border-[var(--border)] overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-[var(--bg-dark)] border-b border-[var(--border)]">
                        <tr>
                            <th className="px-6 py-4 text-sm font-semibold text-[var(--text-secondary)]">Username</th>
                            <th className="px-6 py-4 text-sm font-semibold text-[var(--text-secondary)]">Role</th>
                            <th className="px-6 py-4 text-sm font-semibold text-[var(--text-secondary)]">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                        {users.map(u => (
                            <tr key={u.id} className="hover:bg-[var(--bg-elevated)] transition-colors">
                                <td className="px-6 py-4 font-bold text-white">
                                    {u.username}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide
                    ${u.role === 'admin' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : ''}
                    ${u.role === 'manager' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : ''}
                    ${u.role === 'cashier' ? 'bg-gray-500/10 text-gray-400 border border-gray-500/20' : ''}
                  `}>
                                        {u.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="px-2 py-1 bg-green-500/10 text-green-400 text-xs rounded border border-green-500/20">
                                        Active
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
