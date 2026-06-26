'use client';
import { useState, useEffect } from 'react';
import { UserSession, createUser, updateUser } from '@/lib/tauri-commands';
import { setUserPin, unlockUser } from '@/lib/api/auth';
import { Save, Key, Shield, Hash, AlertTriangle, LockOpen } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { normalizeRole, roleI18nKey } from '@/lib/permissions';
import { useLanguage } from '@/providers/LanguageProvider';
import SidebarDrawer from './SidebarDrawer';
 
interface UserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    user?: UserSession | null;
}
 
export default function UserModal({ isOpen, onClose, onSave, user }: UserModalProps) {
    const { user: currentUser } = useAuth();
    const { t } = useLanguage();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'admin' | 'business_admin' | 'cashier'>('cashier');
    const [fullName, setFullName] = useState('');
    const [khmerName, setKhmerName] = useState('');
    const [pinInput, setPinInput] = useState('');
    const [pinError, setPinError] = useState('');
    const [saveError, setSaveError] = useState('');
    const [loading, setLoading] = useState(false);
    const [unlocking, setUnlocking] = useState(false);
    const isAdmin = normalizeRole(currentUser?.role) === 'admin' || normalizeRole(currentUser?.role) === 'super_admin';
    const isLocked = !!user?.locked_until && new Date(user.locked_until.replace(' ', 'T')) > new Date();

    async function handleUnlock() {
        if (!user) return;
        setUnlocking(true);
        try {
            await unlockUser(user.id, currentUser?.restaurant_id || '');
            onSave();
            onClose();
        } catch (error) {
            console.error(error);
            setSaveError(error instanceof Error ? error.message : t('saveFailed'));
        } finally {
            setUnlocking(false);
        }
    }

    useEffect(() => {
        if (user) {
            setUsername(user.username);
            setPassword('');
            setRole((normalizeRole(user.role) as 'admin' | 'business_admin' | 'cashier') || 'cashier');
            setFullName(user.full_name || '');
            setKhmerName(user.khmer_name || '');
        } else {
            setUsername('');
            setPassword('');
            setRole('cashier');
            setFullName('');
            setKhmerName('');
        }
        setPinInput('');
        setPinError('');
        setSaveError('');
    }, [user, isOpen]);
 
    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setPinError('');
        if (pinInput && (pinInput.length < 4 || pinInput.length > 6 || !/^\d+$/.test(pinInput))) {
            setPinError('PIN must be 4-6 digits.');
            return;
        }
        setLoading(true);
        try {
            const restaurantId = currentUser?.restaurant_id || '';
            if (user) {
                await updateUser(
                    user.id,
                    password || undefined,
                    role,
                    restaurantId,
                    fullName || undefined,
                    khmerName || undefined
                );
                if (pinInput && restaurantId) {
                    await setUserPin(restaurantId, user.id, pinInput);
                }
            } else {
                if (!password) throw new Error('Password required for new users');
                if (!restaurantId) throw new Error('No restaurant context found');

                const newId = await createUser(
                    username,
                    password,
                    role,
                    restaurantId,
                    fullName || undefined,
                    khmerName || undefined
                );
                if (pinInput && newId) {
                    await setUserPin(restaurantId, newId, pinInput);
                }
            }
            onSave();
            onClose();
        } catch (error) {
            console.error(error);
            const detail = isAdmin && error instanceof Error ? error.message : '';
            setSaveError(detail || t('saveFailed'));
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
                    <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">Username</label>
                    <input
                        required
                        disabled={!!user}
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--foreground)] placeholder:text-[var(--text-secondary)]/50 focus:border-[var(--accent)] outline-none transition-all font-medium disabled:opacity-50"
                        placeholder={t('phUsernameExample')}
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                        {user ? 'New Password (leave blank to keep)' : 'Password'}
                    </label>
                    <div className="relative">
                        <Key size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-50" />
                        <input
                            type="password"
                            required={!user}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl pl-10 pr-4 py-3 text-[var(--foreground)] placeholder:text-[var(--text-secondary)]/50 focus:border-[var(--accent)] outline-none transition-all font-mono"
                            placeholder="••••••••"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">Full Name</label>
                        <input
                            value={fullName}
                            onChange={e => setFullName(e.target.value)}
                            className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--foreground)] placeholder:text-[var(--text-secondary)]/50 focus:border-[var(--accent)] outline-none transition-all font-medium"
                            placeholder={t('phFullNameExample')}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">Khmer Name</label>
                        <input
                            value={khmerName}
                            onChange={e => setKhmerName(e.target.value)}
                            className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--foreground)] placeholder:text-[var(--text-secondary)]/50 focus:border-[var(--accent)] outline-none transition-all khmer"
                            placeholder="ចន ដូ"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">Role & Permissions</label>
                    <div className="grid grid-cols-3 gap-2">
                        {(['admin', 'business_admin', 'cashier'] as const).map((r) => (
                            <button
                                key={r}
                                type="button"
                                onClick={() => setRole(r)}
                                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all ${
                                    role === r 
                                        ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--foreground)]' 
                                        : 'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/40'
                                }`}
                            >
                                <Shield size={14} className={role === r ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'} />
                                <span className="text-xs font-bold capitalize">{t(roleI18nKey(r))}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                        Quick PIN <span className="text-[var(--text-secondary)]/40 normal-case tracking-normal font-normal">(optional, 4–6 digits)</span>
                    </label>
                    <div className="relative">
                        <Hash size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-50" />
                        <input
                            type="password"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={6}
                            value={pinInput}
                            onChange={e => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl pl-10 pr-4 py-3 text-[var(--foreground)] placeholder:text-[var(--text-secondary)]/50 focus:border-[var(--accent)] outline-none transition-all font-mono tracking-[0.5em] text-center"
                            placeholder="• • • •"
                        />
                    </div>
                    {pinError && <p className="text-xs text-red-400">{pinError}</p>}
                </div>

                {user && isAdmin && isLocked && (
                    <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/25">
                        <div className="flex items-start gap-2 text-amber-400 text-xs font-medium">
                            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                            <span>{t('accountLocked')}</span>
                        </div>
                        <button
                            type="button"
                            onClick={handleUnlock}
                            disabled={unlocking}
                            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
                        >
                            <LockOpen size={13} /> {t('unlockAccount')}
                        </button>
                    </div>
                )}

                {saveError && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 text-xs font-medium">
                        <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                        <span>{saveError}</span>
                    </div>
                )}

                <div className="flex items-center gap-3 pt-2 border-t border-[var(--border)]">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--bg-elevated)] transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 py-3 rounded-xl bg-[var(--accent)] text-white font-black text-sm shadow-lg shadow-[var(--accent)]/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
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
