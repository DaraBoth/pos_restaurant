'use client';

import { useEffect, useState } from 'react';
import { Edit2, Check } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { getRestaurant, Restaurant } from '@/lib/tauri-commands';
import { updateUser } from '@/lib/api/auth';
import { roleI18nKey } from '@/lib/permissions';
import type { TranslationKey } from '@/lib/i18n';
import Toast from '@/components/ui/Toast';
import SettingsSection from '../SettingsSection';

const getJobTitleKey = (role: string): TranslationKey => {
    switch (role) {
        case 'super_admin': return 'jobSuperAdmin';
        case 'admin': return 'jobSysAdmin';
        case 'business_admin':
        case 'manager': return 'jobBizAdmin';
        case 'cashier': return 'jobHeadCashier';
        default: return 'jobAssociate';
    }
};

const getDepartmentKey = (role: string): TranslationKey => {
    switch (role) {
        case 'super_admin':
        case 'admin': return 'deptSystemAdmin';
        case 'business_admin':
        case 'manager': return 'deptOperations';
        case 'cashier': return 'deptPosOps';
        default: return 'deptGeneralService';
    }
};

export default function ProfileSettingsPage() {
    const { user, setUser } = useAuth();
    const { t } = useLanguage();

    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
    const [appVersion, setAppVersion] = useState('...');
    const [userAvatar, setUserAvatar] = useState<string | null>(null);

    const [fullName, setFullName] = useState(user?.full_name || '');
    const [khmerName, setKhmerName] = useState(user?.khmer_name || '');
    const [isEditingName, setIsEditingName] = useState(false);
    const [mobile, setMobile] = useState(user?.phone || '');
    const [isEditingMobile, setIsEditingMobile] = useState(false);
    const [savingAccount, setSavingAccount] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [errorToast, setErrorToast] = useState<string | null>(null);

    useEffect(() => {
        setFullName(user?.full_name || '');
        setKhmerName(user?.khmer_name || '');
        setMobile(user?.phone || '');
        if (user) setUserAvatar(localStorage.getItem(`dineos_user_avatar_${user.id}`));
    }, [user]);

    useEffect(() => {
        function reloadBusiness() {
            getRestaurant(user?.restaurant_id || undefined).then(setRestaurant).catch(console.error);
        }
        reloadBusiness();
        window.addEventListener('business-updated', reloadBusiness);
        return () => window.removeEventListener('business-updated', reloadBusiness);
    }, [user]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        import('@tauri-apps/api/app')
            .then(m => m.getVersion())
            .then(v => setAppVersion(v))
            .catch(() => setAppVersion(''));
    }, []);

    async function handleSaveAccount() {
        if (!user) return;
        setSavingAccount(true);
        try {
            await updateUser(user.id, undefined, user.role, user.restaurant_id || '', fullName.trim() || undefined, khmerName.trim() || undefined, user.phone || undefined);
            setUser({ ...user, full_name: fullName.trim(), khmer_name: khmerName.trim() });
            setIsEditingName(false);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        } catch (e) {
            console.error(e);
            setErrorToast(t('failedUpdateAccount'));
        } finally {
            setSavingAccount(false);
        }
    }

    async function handleSaveMobile() {
        if (!user) return;
        setSavingAccount(true);
        try {
            await updateUser(user.id, undefined, user.role, user.restaurant_id || '', user.full_name || undefined, user.khmer_name || undefined, mobile.trim() || undefined);
            setUser({ ...user, phone: mobile.trim() || undefined });
            setIsEditingMobile(false);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        } catch (e) {
            console.error(e);
            setErrorToast(t('failedUpdateMobile'));
        } finally {
            setSavingAccount(false);
        }
    }

    async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !user) return;
        try {
            const dataUri = await new Promise<string>((resolve, reject) => {
                const img = new window.Image();
                img.onload = () => {
                    const MAX = 256;
                    const scale = Math.min(1, MAX / Math.max(img.width, img.height));
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.round(img.width * scale);
                    canvas.height = Math.round(img.height * scale);
                    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/png'));
                };
                img.onerror = reject;
                img.src = URL.createObjectURL(file);
            });
            localStorage.setItem(`dineos_user_avatar_${user.id}`, dataUri);
            setUserAvatar(dataUri);
            window.dispatchEvent(new Event('user-avatar-updated'));
        } catch (err) {
            console.error('Failed to save profile picture:', err);
            setErrorToast(t('failedSaveProfilePicture'));
        }
    }

    function handleRemoveAvatar() {
        if (!user) return;
        localStorage.removeItem(`dineos_user_avatar_${user.id}`);
        setUserAvatar(null);
        window.dispatchEvent(new Event('user-avatar-updated'));
    }

    const rowClass = 'py-4 border-b border-[var(--border)] space-y-1';
    const labelClass = 'block text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] opacity-60';

    return (
        <SettingsSection title={t('settingsProfileHeader')} description={t('settingsProfileDesc')}>
            {/* Avatar */}
            <div className="flex items-center gap-4 py-2">
                <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-[var(--border)] flex items-center justify-center overflow-hidden bg-[var(--bg-elevated)] flex-shrink-0">
                    {userAvatar ? (
                        <img src={userAvatar} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] flex items-center justify-center font-black text-2xl">
                            {(fullName || user?.username || '?').charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>
                <div className="flex flex-col gap-2">
                    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--accent-blue)] text-white text-xs font-bold cursor-pointer hover:brightness-110 active:scale-95 transition-all w-fit">
                        <Edit2 size={12} /> {t('changeImage')}
                        <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
                    </label>
                    {userAvatar && (
                        <button onClick={handleRemoveAvatar} className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:text-red-400 transition-colors w-fit">
                            {t('removeAvatar')}
                        </button>
                    )}
                </div>
            </div>

            {/* App version */}
            <div className={rowClass}>
                <label className={labelClass}>{t('currentVersion')}</label>
                <p className="text-xs font-bold text-[var(--foreground)]">DineOS Professional {appVersion ? `v${appVersion}` : ''}</p>
            </div>

            {/* Username (read-only) */}
            <div className={rowClass}>
                <label className={labelClass}>{t('idUsername')}</label>
                <p className="text-xs font-black text-[var(--foreground)]">{user?.username}</p>
            </div>

            {/* Display name (editable) */}
            <div className="py-4 border-b border-[var(--border)] flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1 min-w-0">
                    <label className={labelClass}>{t('displayName')}</label>
                    {isEditingName ? (
                        <div className="flex flex-wrap gap-2 mt-1">
                            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder={t('phEnglishName')} className="pos-input flex-1 min-w-[140px]" />
                            <input type="text" value={khmerName} onChange={e => setKhmerName(e.target.value)} placeholder={t('phKhmerName')} className="pos-input flex-1 min-w-[140px] khmer" />
                            <button onClick={handleSaveAccount} disabled={savingAccount} className="px-3 rounded-xl bg-[var(--accent-blue)] text-white text-xs font-bold hover:brightness-110 active:scale-95 transition-all flex items-center gap-1 disabled:opacity-50">
                                {savingAccount ? '...' : <Check size={12} />}
                            </button>
                        </div>
                    ) : (
                        <p className="text-xs font-black text-[var(--foreground)]">{fullName || t('noNameSet')} {khmerName ? `(${khmerName})` : ''}</p>
                    )}
                </div>
                {!isEditingName && (
                    <button onClick={() => setIsEditingName(true)} className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--accent-blue)] transition-all flex-shrink-0">
                        <Edit2 size={13} />
                    </button>
                )}
            </div>

            {/* Company name (read-only) */}
            <div className={rowClass}>
                <label className={labelClass}>{t('companyBusinessName')}</label>
                <p className="text-xs font-bold text-[var(--foreground)]">{restaurant?.name || t('loadingBusiness')}</p>
            </div>

            {/* Department (read-only) */}
            <div className={rowClass}>
                <label className={labelClass}>{t('department')}</label>
                <p className="text-xs font-bold text-[var(--foreground)]">{t(getDepartmentKey(user?.role || ''))}</p>
            </div>

            {/* Job title (read-only) */}
            <div className={rowClass}>
                <label className={labelClass}>{t('jobTitle')}</label>
                <p className="text-xs font-bold text-[var(--foreground)]">{t(getJobTitleKey(user?.role || ''))}</p>
            </div>

            {/* Role badge (read-only) */}
            <div className={rowClass}>
                <label className={labelClass}>{t('settingsProfile')}</label>
                <p className="text-xs font-bold text-[var(--foreground)]">{t(roleI18nKey(user?.role))}</p>
            </div>

            {/* Mobile (editable) */}
            <div className="py-4 border-b border-[var(--border)] flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1 min-w-0">
                    <label className={labelClass}>{t('mobileNumber')}</label>
                    {isEditingMobile ? (
                        <div className="flex gap-2 mt-1 max-w-sm">
                            <input type="text" value={mobile} onChange={e => setMobile(e.target.value)} className="pos-input flex-1" />
                            <button onClick={handleSaveMobile} disabled={savingAccount} className="px-3 rounded-xl bg-[var(--accent-blue)] text-white text-xs font-bold hover:brightness-110 active:scale-95 transition-all flex items-center disabled:opacity-50">
                                <Check size={12} />
                            </button>
                        </div>
                    ) : (
                        <p className="text-xs font-bold text-[var(--foreground)]">{mobile || t('noMobileSet')}</p>
                    )}
                </div>
                {!isEditingMobile && (
                    <button onClick={() => setIsEditingMobile(true)} className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--accent-blue)] transition-all flex-shrink-0">
                        <Edit2 size={13} />
                    </button>
                )}
            </div>

            {saveSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-2 animate-fade-in">
                    <Check size={14} /> {t('profileUpdatedSuccess')}
                </div>
            )}

            {errorToast && <Toast message={errorToast} variant="error" onClose={() => setErrorToast(null)} />}
        </SettingsSection>
    );
}
