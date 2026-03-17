'use client';
import { useState, useEffect } from 'react';
import { UserSession, createUser, updateUser } from '@/lib/tauri-commands';
import { X, Save, UserCircle, Shield, Key } from 'lucide-react';

interface UserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    user?: UserSession | null;
}

export default function UserModal({ isOpen, onClose, onSave, user }: UserModalProps) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'admin' | 'manager' | 'cashier' | 'waiter'>('cashier');
    const [fullName, setFullName] = useState('');
    const [khmerName, setKhmerName] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user) {
            setUsername(user.username);
            setPassword(''); // Don't show existing hash
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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#181a20] border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
                <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-[#0f1115]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
                            <UserCircle size={20} className="text-[var(--accent)]" />
                        </div>
                        <h2 className="text-xl font-bold text-white">
                            {user ? 'Edit Staff Member' : 'Register New Staff'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 text-[#8a8a99] transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2 col-span-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-[#8a8a99] ml-1">Username</label>
                            <input
                                required
                                disabled={!!user}
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                className="w-full bg-[#0f1115] border border-white/5 rounded-2xl px-5 py-3.5 text-white focus:border-[var(--accent)] outline-none transition-all font-medium disabled:opacity-50"
                                placeholder="e.g. johndoe"
                            />
                        </div>

                        <div className="space-y-2 col-span-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-[#8a8a99] ml-1">
                                {user ? 'New Password (Leave blank to keep current)' : 'Password'}
                            </label>
                            <div className="relative">
                                <Key size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8a8a99]/40" />
                                <input
                                    type="password"
                                    required={!user}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full bg-[#0f1115] border border-white/5 rounded-2xl pl-12 pr-6 py-3.5 text-white focus:border-[var(--accent)] outline-none transition-all font-mono"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-[#8a8a99] ml-1">Full Name</label>
                            <input
                                value={fullName}
                                onChange={e => setFullName(e.target.value)}
                                className="w-full bg-[#0f1115] border border-white/5 rounded-2xl px-5 py-3.5 text-white focus:border-[var(--accent)] outline-none transition-all font-medium"
                                placeholder="John Doe"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-[#8a8a99] ml-1">Khmer Name</label>
                            <input
                                value={khmerName}
                                onChange={e => setKhmerName(e.target.value)}
                                className="w-full bg-[#0f1115] border border-white/5 rounded-2xl px-5 py-3.5 text-white focus:border-[var(--accent)] outline-none transition-all khmer"
                                placeholder="ចន ដូ"
                            />
                        </div>

                        <div className="space-y-2 col-span-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-[#8a8a99] ml-1">Role & Permissions</label>
                            <div className="grid grid-cols-2 gap-3">
                                {['admin', 'manager', 'cashier', 'waiter'].map((r) => (
                                    <button
                                        key={r}
                                        type="button"
                                        onClick={() => setRole(r as any)}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${
                                            role === r 
                                                ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-white' 
                                                : 'bg-[#0f1115] border-white/5 text-[#8a8a99] hover:border-white/20'
                                        }`}
                                    >
                                        <Shield size={16} className={role === r ? 'text-[var(--accent)]' : 'text-[#8a8a99]'} />
                                        <span className="text-sm font-bold capitalize">{r}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-4 pt-4 border-t border-white/5">
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
                            {user ? 'Update Profile' : 'Register Member'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
