'use client';
import { useState, useEffect } from 'react';
import { UserSession, createUser, updateUser } from '@/lib/tauri-commands';
import { Save, Key, Shield } from 'lucide-react';
import SidebarDrawer from './SidebarDrawer';

interface UserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    user?: UserSession | null;
}

export default function UserModal({ isOpen, onClose, onSave, user }: UserModalProps) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'admin' | 'manager' | 'cashier' | 'waiter' | 'chef'>('cashier');
    const [fullName, setFullName] = useState('');
    const [khmerName, setKhmerName] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user) {
            setUsername(user.username);
            setPassword('');
            setRole(user.role);
            setFullName(user.full_name || '');
            setKhmerName(user.khmer_name || '');
        } else {
            setUsername('');
            setPassword('');
            setRole('cashier');
            setFullName('');
            setKhmerName('');
        }
    }, [user, isOpen]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        try {
            if (user) {
                await updateUser(
                    user.id, 
                    password || undefined, 
                    role, 
                    fullName || undefined, 
                    khmerName || undefined
                );
            } else {
                if (!password) throw new Error('Password required for new users');
                await createUser(
                    username, 
                    password, 
                    role, 
                    fullName || undefined, 
                    khmerName || undefined
                );
            }
            onSave();
            onClose();
        } catch (error) {
            console.error(error);
            alert('Failed to save user');
        } finally {
            setLoading(false);
        }
    }

    return (
        <SidebarDrawer
            isOpen={isOpen}
            onClose={onClose}
            title={user ? 'Edit Staff Member' : 'Register New Staff'}
            subtitle={user ? `Editing: ${user.username}` : 'Create a new staff account'}
        >
            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-[#8a8a99]">Username</label>
                    <input
                        required
                        disabled={!!user}
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        className="w-full bg-[#0f1115] border border-white/5 rounded-2xl px-5 py-3.5 text-white focus:border-[var(--accent)] outline-none transition-all font-medium disabled:opacity-50"
                        placeholder="e.g. johndoe"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-[#8a8a99]">
                        {user ? 'New Password (leave blank to keep)' : 'Password'}
                    </label>
                    <div className="relative">
                        <Key size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8a8a99]/40" />
                        <input
                            type="password"
                            required={!user}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full bg-[#0f1115] border border-white/5 rounded-2xl pl-12 pr-6 py-3.5 text-white focus:border-[var(--accent)] outline-none transition-all font-mono"
                            placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-[#8a8a99]">Full Name</label>
                        <input
                            value={fullName}
                            onChange={e => setFullName(e.target.value)}
                            className="w-full bg-[#0f1115] border border-white/5 rounded-2xl px-5 py-3.5 text-white focus:border-[var(--accent)] outline-none transition-all font-medium"
                            placeholder="John Doe"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-[#8a8a99]">Khmer Name</label>
                        <input
                            value={khmerName}
                            onChange={e => setKhmerName(e.target.value)}
                            className="w-full bg-[#0f1115] border border-white/5 rounded-2xl px-5 py-3.5 text-white focus:border-[var(--accent)] outline-none transition-all khmer"
                            placeholder="áž…áž“ ážŠáž¼"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-[#8a8a99]">Role & Permissions</label>
                    <div className="grid grid-cols-3 gap-2">
                        {(['admin', 'manager', 'cashier', 'waiter', 'chef'] as const).map((r) => (
                            <button
                                key={r}
                                type="button"
                                onClick={() => setRole(r)}
                                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all ${
                                    role === r 
                                        ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-white' 
                                        : 'bg-[#0f1115] border-white/5 text-[#8a8a99] hover:border-white/20'
                                }`}
                            >
                                <Shield size={14} className={role === r ? 'text-[var(--accent)]' : 'text-[#8a8a99]'} />
                                <span className="text-xs font-bold capitalize">{r}</span>
                            </button>
                        ))}
                    </div>
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
                        {user ? 'Update Profile' : 'Register Member'}
                    </button>
                </div>
            </form>
        </SidebarDrawer>
    );
}
