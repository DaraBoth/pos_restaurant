'use client';

import { useState } from 'react';
import { Eye, EyeOff, Check } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { changePassword } from '@/lib/api/auth';
import SettingsSection from '../SettingsSection';

export default function PasswordSettingsPage() {
    const { user } = useAuth();
    const { t } = useLanguage();

    const [currentPwd, setCurrentPwd] = useState('');
    const [newPwd, setNewPwd] = useState('');
    const [confirmPwd, setConfirmPwd] = useState('');
    const [pwdError, setPwdError] = useState('');
    const [pwdSuccess, setPwdSuccess] = useState(false);
    const [savingPwd, setSavingPwd] = useState(false);
    const [showPwd, setShowPwd] = useState(false);

    async function handleChangePassword() {
        if (!user) return;
        setPwdError('');
        if (newPwd.length < 6) { setPwdError(t('passwordMinLength')); return; }
        if (newPwd !== confirmPwd) { setPwdError(t('passwordMismatch')); return; }
        setSavingPwd(true);
        try {
            await changePassword(user.id, currentPwd, newPwd);
            setCurrentPwd('');
            setNewPwd('');
            setConfirmPwd('');
            setPwdSuccess(true);
            setTimeout(() => setPwdSuccess(false), 3000);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setPwdError(msg.includes('incorrect') ? t('currentPasswordIncorrect') : msg);
        } finally {
            setSavingPwd(false);
        }
    }

    const fields = [
        { label: t('currentPassword'), value: currentPwd, set: setCurrentPwd, auto: 'current-password' },
        { label: t('newPassword'), value: newPwd, set: setNewPwd, auto: 'new-password' },
        { label: t('confirmNewPassword'), value: confirmPwd, set: setConfirmPwd, auto: 'new-password' },
    ];

    return (
        <SettingsSection title={t('settingsPasswordHeader')} description={t('settingsPasswordDesc')}>
            <div className="max-w-md space-y-4">
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={() => setShowPwd(v => !v)}
                        className="flex items-center gap-1 text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--accent-blue)] transition-colors"
                    >
                        {showPwd ? <EyeOff size={13} /> : <Eye size={13} />}
                        {showPwd ? t('hide') : t('show')}
                    </button>
                </div>

                {fields.map((f, i) => (
                    <div key={i} className="space-y-1.5">
                        <label className="block text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] opacity-70">{f.label}</label>
                        <input
                            type={showPwd ? 'text' : 'password'}
                            autoComplete={f.auto}
                            placeholder={f.label}
                            value={f.value}
                            onChange={e => f.set(e.target.value)}
                            className="pos-input w-full"
                        />
                    </div>
                ))}

                {pwdError && <p className="text-xs text-red-400 font-bold">{pwdError}</p>}
                {pwdSuccess && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-2 animate-fade-in">
                        <Check size={14} /> {t('passwordUpdated')}
                    </div>
                )}

                <button
                    onClick={handleChangePassword}
                    disabled={savingPwd || !currentPwd || !newPwd || !confirmPwd}
                    className="px-5 py-2.5 rounded-xl bg-[var(--accent-blue)] text-white text-xs font-bold uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {savingPwd ? t('saving') : t('savePassword')}
                </button>
            </div>
        </SettingsSection>
    );
}
