'use client';

import { useState, useEffect } from 'react';
import {
    X, User, Monitor, Globe, Building2, Check, Edit2,
    ArrowRightLeft, MapPin, Image, StickyNote, Info, CloudOff, Download, ExternalLink,
    Eye, EyeOff, Lock
} from 'lucide-react';
import { useAuth, getSessionTimeoutMs, SESSION_TIMEOUT_KEY } from '@/providers/AuthProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { getRestaurant, Restaurant } from '@/lib/tauri-commands';
import { roleI18nKey } from '@/lib/permissions';
import type { TranslationKey } from '@/lib/i18n';
import Toast from '@/components/ui/Toast';
import { updateUser, changePassword } from '@/lib/api/auth';
import { getExchangeRate } from '@/lib/api/system';
import { formatKhr } from '@/lib/currency';
import type { ExchangeRate } from '@/types';
import Link from 'next/link';
import RestaurantSettingsForm from '../management/RestaurantSettingsForm';
import ExchangeRateManagement from '@/app/management/exchange-rate/page';
import { CloudResetDialog } from '../management/CloudResetDialog';
import { CustomSelect } from '@/components/ui/CustomSelect';

interface MySettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type TabType = 
    | 'account' 
    | 'displayLanguage' 
    | 'exchange' 
    | 'biz_identity' 
    | 'biz_address' 
    | 'biz_branding' 
    | 'biz_receipt' 
    | 'biz_operational' 
    | 'biz_sync';

export default function MySettingsModal({ isOpen, onClose }: MySettingsModalProps) {
    const { user, setUser } = useAuth();
    const { t, lang, setLang } = useLanguage();
    const { theme, setTheme } = useTheme();

    const [activeTab, setActiveTab] = useState<TabType>('account');
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
    const [readonlyRate, setReadonlyRate] = useState<ExchangeRate | null>(null);
    const [appVersion, setAppVersion] = useState('...');

    // Profile Account inputs
    const [fullName, setFullName] = useState(user?.full_name || '');
    const [khmerName, setKhmerName] = useState(user?.khmer_name || '');
    const [isEditingName, setIsEditingName] = useState(false);
    const [savingAccount, setSavingAccount] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [userAvatar, setUserAvatar] = useState<string | null>(null);

    // Mock mobile & email storage for realistic feel
    const [mobile, setMobile] = useState('');
    const [isEditingMobile, setIsEditingMobile] = useState(false);

    // Change Password
    const [currentPwd, setCurrentPwd] = useState('');
    const [newPwd, setNewPwd] = useState('');
    const [confirmPwd, setConfirmPwd] = useState('');
    const [pwdError, setPwdError] = useState('');
    const [pwdSuccess, setPwdSuccess] = useState(false);
    const [savingPwd, setSavingPwd] = useState(false);
    const [showPwd, setShowPwd] = useState(false);


    // Auto-logout / session timeout (admin-configurable; all roles inherit it)
    const [sessionTimeoutMs, setSessionTimeoutMs] = useState<number>(() => getSessionTimeoutMs());

    // Error toast for save failures
    const [errorToast, setErrorToast] = useState<string | null>(null);

    const isAdmin = user?.role === 'admin';

    useEffect(() => {
        if (isOpen) {
            setFullName(user?.full_name || '');
            setKhmerName(user?.khmer_name || '');
            setMobile(user?.phone || '');
            setIsEditingName(false);
            setIsEditingMobile(false);
            setCurrentPwd('');
            setNewPwd('');
            setConfirmPwd('');
            setPwdError('');
            setPwdSuccess(false);
            
            if (user) {
                setUserAvatar(localStorage.getItem(`dineos_user_avatar_${user.id}`));
            }

            getRestaurant(user?.restaurant_id || undefined)
                .then(setRestaurant)
                .catch(console.error);
        }
    }, [isOpen, user]);

    // Listen to business configuration updates dynamically
    useEffect(() => {
        if (!isOpen) return;
        function reloadBusiness() {
            getRestaurant(user?.restaurant_id || undefined)
                .then(setRestaurant)
                .catch(console.error);
        }
        window.addEventListener('business-updated', reloadBusiness);
        return () => {
            window.removeEventListener('business-updated', reloadBusiness);
        };
    }, [isOpen, user]);

    useEffect(() => {
        if (activeTab === 'exchange' && !isAdmin && user?.restaurant_id) {
            getExchangeRate(user.restaurant_id)
                .then(setReadonlyRate)
                .catch(console.error);
        }
    }, [activeTab, isAdmin, user?.restaurant_id]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        import('@tauri-apps/api/app')
            .then(m => m.getVersion())
            .then(v => setAppVersion(v))
            .catch(() => setAppVersion(''));
    }, []);

    if (!isOpen) return null;

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
            if (msg.includes('incorrect')) {
                setPwdError(t('currentPasswordIncorrect'));
            } else {
                setPwdError(msg);
            }
        } finally {
            setSavingPwd(false);
        }
    }

    async function handleSaveAccount() {
        if (!user) return;
        setSavingAccount(true);
        try {
            await updateUser(
                user.id,
                undefined, // password unchanged
                user.role,
                user.restaurant_id || '',
                fullName.trim() || undefined,
                khmerName.trim() || undefined,
                user.phone || undefined
            );
            
            // Update auth state session
            setUser({
                ...user,
                full_name: fullName.trim(),
                khmer_name: khmerName.trim(),
            });

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
            await updateUser(
                user.id,
                undefined,
                user.role,
                user.restaurant_id || '',
                user.full_name || undefined,
                user.khmer_name || undefined,
                mobile.trim() || undefined
            );
            
            setUser({
                ...user,
                phone: mobile.trim() || undefined
            });

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

    // Role Job Title translation mapping
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
            case 'admin':
                return 'deptSystemAdmin';
            case 'business_admin':
            case 'manager':
                return 'deptOperations';
            case 'cashier':
                return 'deptPosOps';
            default:
                return 'deptGeneralService';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-3xl w-full max-w-4xl h-[85vh] flex overflow-hidden shadow-2xl animate-scale-up relative">
                
                {/* ── Sidebar ── */}
                <div className="w-56 bg-[var(--bg-dark)] border-r border-[var(--border)] flex flex-col p-4 flex-shrink-0">
                    
                    {/* User profile picture uploading */}
                    <div className="flex flex-col items-center py-4 mb-4 text-center">
                        <div className="relative group">
                            <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-[var(--border)] flex items-center justify-center overflow-hidden bg-[var(--bg-elevated)] relative group-hover:border-[var(--accent-blue)]/50 transition-all">
                                {userAvatar ? (
                                    <img src={userAvatar} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] flex items-center justify-center font-black text-2xl">
                                        {fullName ? fullName.charAt(0).toUpperCase() : user?.username.charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <label className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-[var(--accent-blue)] text-white shadow-md border border-[var(--border)] flex items-center justify-center cursor-pointer hover:scale-115 active:scale-95 transition-all">
                                <Edit2 size={12} />
                                <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file || !user) return;
                                    try {
                                        const dataUri = await new Promise<string>((resolve, reject) => {
                                            const img = new window.Image();
                                            img.onload = () => {
                                                const MAX = 256;
                                                const scale = Math.min(1, MAX / Math.max(img.width, img.height));
                                                const canvas = document.createElement('canvas');
                                                canvas.width  = Math.round(img.width  * scale);
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
                                }} />
                            </label>
                        </div>
                        {userAvatar && (
                            <button 
                                onClick={() => {
                                    if (user) {
                                        localStorage.removeItem(`dineos_user_avatar_${user.id}`);
                                        setUserAvatar(null);
                                        window.dispatchEvent(new Event('user-avatar-updated'));
                                    }
                                }}
                                className="text-[9px] font-black text-red-500 uppercase tracking-widest mt-2 hover:text-red-400 transition-colors"
                            >
                                {t('removeAvatar')}
                            </button>
                        )}
                        <h2 className="text-xs font-black text-[var(--foreground)] mt-3 tracking-tight truncate w-full px-2">
                            {fullName || user?.username}
                        </h2>
                        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60 mt-0.5">
                            {t(roleI18nKey(user?.role))}
                        </span>
                    </div>

                    {/* Tab Navigation items */}
                    <nav className="flex-1 flex flex-col gap-0.5 overflow-y-auto no-scrollbar">
                        <button
                            onClick={() => setActiveTab('account')}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left ${activeTab === 'account' 
                                ? 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] border border-[var(--accent-blue)]/35 font-black' 
                                : 'text-[var(--text-secondary)] border border-transparent hover:text-[var(--foreground)] hover:bg-[var(--bg-elevated)]'}`}
                        >
                            <User size={14} /> {t('settingsAccount')}
                        </button>
                        <button
                            onClick={() => setActiveTab('displayLanguage')}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left ${activeTab === 'displayLanguage'
                                ? 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] border border-[var(--accent-blue)]/35 font-black'
                                : 'text-[var(--text-secondary)] border border-transparent hover:text-[var(--foreground)] hover:bg-[var(--bg-elevated)]'}`}
                        >
                            <Monitor size={14} /> {t('settingsDisplayLanguage')}
                        </button>
                        <Link
                            href="/downloads"
                            onClick={onClose}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left text-[var(--text-secondary)] border border-transparent hover:text-[var(--foreground)] hover:bg-[var(--bg-elevated)]"
                        >
                            <Download size={14} />
                            <span className="flex-1">{t('downloads')}</span>
                            <ExternalLink size={10} className="opacity-40" />
                        </Link>

                        {/* Exchange Rate — editable for admin, read-only for all other roles */}
                        <button
                            onClick={() => setActiveTab('exchange')}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left ${activeTab === 'exchange'
                                ? 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] border border-[var(--accent-blue)]/35 font-black'
                                : 'text-[var(--text-secondary)] border border-transparent hover:text-[var(--foreground)] hover:bg-[var(--bg-elevated)]'}`}
                        >
                            <ArrowRightLeft size={14} /> {t('settingsExchangeRate')}
                        </button>

                        {/* Business Settings Category (Admin only) */}
                        {isAdmin && (
                            <div className="mt-4 space-y-1">
                                <div className="px-3 py-1 text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-55">
                                    {t('settingsBusinessConfig')}
                                </div>
                                <button
                                    onClick={() => setActiveTab('biz_identity')}
                                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all w-full text-left ${activeTab === 'biz_identity'
                                        ? 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] border border-[var(--accent-blue)]/35 font-black'
                                        : 'text-[var(--text-secondary)] border border-transparent hover:text-[var(--foreground)] hover:bg-[var(--bg-elevated)]'}`}
                                >
                                    <Building2 size={14} /> {t('settingsIdentityType')}
                                </button>
                                <button
                                    onClick={() => setActiveTab('biz_address')}
                                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all w-full text-left ${activeTab === 'biz_address'
                                        ? 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] border border-[var(--accent-blue)]/35 font-black'
                                        : 'text-[var(--text-secondary)] border border-transparent hover:text-[var(--foreground)] hover:bg-[var(--bg-elevated)]'}`}
                                >
                                    <MapPin size={14} /> {t('settingsAddressDetails')}
                                </button>
                                <button
                                    onClick={() => setActiveTab('biz_branding')}
                                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all w-full text-left ${activeTab === 'biz_branding'
                                        ? 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] border border-[var(--accent-blue)]/35 font-black'
                                        : 'text-[var(--text-secondary)] border border-transparent hover:text-[var(--foreground)] hover:bg-[var(--bg-elevated)]'}`}
                                >
                                    <Image size={14} /> {t('settingsLogoBranding')}
                                </button>

                                {/* Operational Settings (available for all business types) */}
                                {(
                                    <button
                                        onClick={() => setActiveTab('biz_operational')}
                                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all w-full text-left ${activeTab === 'biz_operational' 
                                            ? 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] border border-[var(--accent-blue)]/35 font-black' 
                                            : 'text-[var(--text-secondary)] border border-transparent hover:text-[var(--foreground)] hover:bg-[var(--bg-elevated)]'}`}
                                    >
                                        <Info size={14} /> {t('settingsOperational')}
                                    </button>
                                )}

                                <button
                                    onClick={() => setActiveTab('biz_sync')}
                                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all w-full text-left ${activeTab === 'biz_sync'
                                        ? 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] border border-[var(--accent-blue)]/35 font-black'
                                        : 'text-[var(--text-secondary)] border border-transparent hover:text-[var(--foreground)] hover:bg-[var(--bg-elevated)]'}`}
                                >
                                    <CloudOff size={14} /> {t('settingsCloudSync')}
                                </button>
                            </div>
                        )}
                    </nav>

                </div>

                {/* ── Content View ── */}
                <div className="flex-1 flex flex-col h-full bg-[var(--bg-card)] overflow-hidden">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
                        <h1 className="text-sm font-black text-[var(--foreground)] uppercase tracking-widest flex items-center gap-2">
                            {activeTab === 'account' && t('settingsAccountHeader')}
                            {activeTab === 'displayLanguage' && t('settingsDisplayHeader')}
                            {activeTab === 'exchange' && t('settingsExchangeHeader')}
                            {activeTab === 'biz_identity' && t('settingsBizIdentityHeader')}
                            {activeTab === 'biz_address' && t('settingsBizAddressHeader')}
                            {activeTab === 'biz_branding' && t('settingsBizBrandingHeader')}
                            {activeTab === 'biz_receipt' && t('settingsBizReceiptHeader')}
                            {activeTab === 'biz_operational' && t('settingsBizOperationsHeader')}
                            {activeTab === 'biz_sync' && t('settingsBizSyncHeader')}
                        </h1>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-xl hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-all cursor-pointer"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Tab view details */}
                    <div className="flex-1 overflow-y-auto no-scrollbar p-6">
                        
                        {/* ── ACCOUNT TAB ── */}
                        {activeTab === 'account' && (
                            <div className="space-y-6">
                                {/* Current version */}
                                <div className="border-b border-[var(--border)] pb-4 space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] opacity-60">{t('currentVersion')}</label>
                                    <p className="text-xs font-bold text-[var(--foreground)]">
                                        DineOS Professional {appVersion ? `v${appVersion}` : ''}
                                    </p>
                                </div>

                                {/* ID / Username */}
                                <div className="border-b border-[var(--border)] pb-4 space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] opacity-60">{t('idUsername')}</label>
                                    <p className="text-xs font-black text-[var(--foreground)]">{user?.username}</p>
                                </div>

                                {/* Name (Editable) */}
                                <div className="border-b border-[var(--border)] pb-4 flex items-center justify-between gap-4">
                                    <div className="space-y-1 flex-1">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] opacity-60">{t('displayName')}</label>
                                        {isEditingName ? (
                                            <div className="flex gap-2 max-w-md mt-1">
                                                <input 
                                                    type="text" 
                                                    value={fullName} 
                                                    onChange={e => setFullName(e.target.value)}
                                                    placeholder={t('phEnglishName')}
                                                    className="flex-1 px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-xs font-bold text-[var(--foreground)] outline-none focus:border-[var(--accent-blue)]"
                                                />
                                                <input
                                                    type="text"
                                                    value={khmerName}
                                                    onChange={e => setKhmerName(e.target.value)}
                                                    placeholder={t('phKhmerName')}
                                                    className="flex-1 px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-xs font-bold text-[var(--foreground)] outline-none focus:border-[var(--accent-blue)] khmer"
                                                />
                                                <button 
                                                    onClick={handleSaveAccount}
                                                    disabled={savingAccount}
                                                    className="px-3 py-1.5 rounded-xl bg-[var(--accent-blue)] text-white text-xs font-bold hover:brightness-110 active:scale-95 transition-all flex items-center gap-1 disabled:opacity-50"
                                                >
                                                    {savingAccount ? '...' : <Check size={12} />}
                                                </button>
                                            </div>
                                        ) : (
                                            <p className="text-xs font-black text-[var(--foreground)]">
                                                {fullName || t('noNameSet')} {khmerName ? `(${khmerName})` : ''}
                                            </p>
                                        )}
                                    </div>
                                    {!isEditingName && (
                                        <button 
                                            onClick={() => setIsEditingName(true)}
                                            className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--accent-blue)] transition-all"
                                        >
                                            <Edit2 size={13} />
                                        </button>
                                    )}
                                </div>

                                {/* Company Name */}
                                <div className="border-b border-[var(--border)] pb-4 space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] opacity-60">{t('companyBusinessName')}</label>
                                    <p className="text-xs font-bold text-[var(--foreground)]">{restaurant?.name || t('loadingBusiness')}</p>
                                </div>

                                {/* Department */}
                                <div className="border-b border-[var(--border)] pb-4 space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] opacity-60">{t('department')}</label>
                                    <p className="text-xs font-bold text-[var(--foreground)]">{t(getDepartmentKey(user?.role || ''))}</p>
                                </div>

                                {/* Job Title */}
                                <div className="border-b border-[var(--border)] pb-4 space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] opacity-60">{t('jobTitle')}</label>
                                    <p className="text-xs font-bold text-[var(--foreground)]">{t(getJobTitleKey(user?.role || ''))}</p>
                                </div>

                                {/* Mobile */}
                                <div className="border-b border-[var(--border)] pb-4 flex items-center justify-between gap-4">
                                    <div className="space-y-1 flex-1">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] opacity-60">{t('mobileNumber')}</label>
                                        {isEditingMobile ? (
                                            <div className="flex gap-2 max-w-sm mt-1">
                                                <input 
                                                    type="text" 
                                                    value={mobile} 
                                                    onChange={e => setMobile(e.target.value)}
                                                    className="flex-1 px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-xs font-bold text-[var(--foreground)] outline-none focus:border-[var(--accent-blue)]"
                                                />
                                                <button 
                                                    onClick={handleSaveMobile}
                                                    className="px-3 py-1.5 rounded-xl bg-[var(--accent-blue)] text-white text-xs font-bold hover:brightness-110 active:scale-95 transition-all flex items-center"
                                                >
                                                    <Check size={12} />
                                                </button>
                                            </div>
                                        ) : (
                                            <p className="text-xs font-bold text-[var(--foreground)]">{mobile || t('noMobileSet')}</p>
                                        )}
                                    </div>
                                    {!isEditingMobile && (
                                        <button 
                                            onClick={() => setIsEditingMobile(true)}
                                            className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--accent-blue)] transition-all"
                                        >
                                            <Edit2 size={13} />
                                        </button>
                                    )}
                                </div>

                                {saveSuccess && (
                                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-2 animate-fade-in">
                                        <Check size={14} /> {t('profileUpdatedSuccess')}
                                    </div>
                                )}

                                {/* Change Password */}
                                <div className="pt-2 space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]/40 p-4 max-w-sm">
                                    <div className="flex items-center justify-between gap-2">
                                        <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] opacity-70">
                                            <Lock size={12} />
                                            {t('changePassword')}
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setShowPwd(v => !v)}
                                            className="flex items-center gap-1 text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--accent-blue)] transition-colors"
                                        >
                                            {showPwd ? <EyeOff size={13} /> : <Eye size={13} />}
                                            {showPwd ? t('hide') : t('show')}
                                        </button>
                                    </div>

                                    {[
                                        { label: t('currentPassword'), value: currentPwd, set: setCurrentPwd, auto: 'current-password' },
                                        { label: t('newPassword'), value: newPwd, set: setNewPwd, auto: 'new-password' },
                                        { label: t('confirmNewPassword'), value: confirmPwd, set: setConfirmPwd, auto: 'new-password' },
                                    ].map((f, i) => (
                                        <div key={i} className="space-y-1">
                                            <label className="block text-[10px] font-bold text-[var(--text-secondary)] opacity-70">{f.label}</label>
                                            <input
                                                type={showPwd ? 'text' : 'password'}
                                                autoComplete={f.auto}
                                                placeholder={f.label}
                                                value={f.value}
                                                onChange={e => f.set(e.target.value)}
                                                className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-sm font-bold text-[var(--foreground)] placeholder:text-[var(--text-secondary)]/40 outline-none focus:border-[var(--accent-blue)] transition-colors"
                                            />
                                        </div>
                                    ))}

                                    {pwdError && (
                                        <p className="text-xs text-red-400 font-bold">{pwdError}</p>
                                    )}
                                    {pwdSuccess && (
                                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-2 animate-fade-in">
                                            <Check size={14} /> {t('passwordUpdated')}
                                        </div>
                                    )}
                                    <button
                                        onClick={handleChangePassword}
                                        disabled={savingPwd || !currentPwd || !newPwd || !confirmPwd}
                                        className="w-full px-4 py-2.5 rounded-xl bg-[var(--accent-blue)] text-white text-xs font-bold uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        {savingPwd ? t('saving') : t('savePassword')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── DISPLAY & LANGUAGE COMBINED TAB ── */}
                        {activeTab === 'displayLanguage' && (
                            <div className="space-y-6">
                                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                                    {t('displayLanguageDesc')}
                                </p>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">{t('themeMode')}</label>
                                    <CustomSelect
                                        value={theme}
                                        onChange={(val) => setTheme(val as 'light' | 'dark')}
                                        options={[
                                            { label: t('darkModeLabel'), value: 'dark' },
                                            { label: t('lightModeLabel'), value: 'light' }
                                        ]}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">{t('interfaceLanguage')}</label>
                                    <CustomSelect
                                        value={lang}
                                        onChange={(val) => setLang(val as 'en' | 'km')}
                                        options={[
                                            { label: 'English (US)', value: 'en' },
                                            { label: 'ភាសាខ្មែរ (Khmer)', value: 'km' }
                                        ]}
                                    />
                                </div>

                                {/* Auto-logout — admin only; cashiers inherit this value */}
                                {isAdmin && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">{t('sessionTimeout')}</label>
                                        <CustomSelect
                                            value={String(sessionTimeoutMs)}
                                            onChange={(val) => {
                                                const ms = parseInt(val, 10) || 0;
                                                setSessionTimeoutMs(ms);
                                                localStorage.setItem(SESSION_TIMEOUT_KEY, String(ms));
                                                window.dispatchEvent(new Event('session-timeout-changed'));
                                            }}
                                            options={[
                                                { label: t('never'), value: '0' },
                                                { label: t('timeout30min'), value: String(30 * 60 * 1000) },
                                                { label: t('timeout1h'), value: String(60 * 60 * 1000) },
                                                { label: t('timeout4h'), value: String(4 * 60 * 60 * 1000) },
                                                { label: t('timeout8h'), value: String(8 * 60 * 60 * 1000) },
                                            ]}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── EXCHANGE RATE SETTINGS TAB ── */}
                        {activeTab === 'exchange' && isAdmin && (
                            <div className="h-full pr-1">
                                <ExchangeRateManagement />
                            </div>
                        )}
                        {activeTab === 'exchange' && !isAdmin && (
                            <div className="space-y-4">
                                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60">
                                    {t('currentRate')}
                                </p>
                                {readonlyRate ? (
                                    <>
                                        <div className="p-4 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl space-y-1">
                                            <p className="text-sm font-black text-[var(--foreground)]">
                                                1 USD = {readonlyRate.rate.toLocaleString()} ៛
                                            </p>
                                            <p className="text-[10px] text-white/40 font-mono">
                                                ≈ {formatKhr(readonlyRate.rate)}
                                            </p>
                                        </div>
                                        <p className="text-[10px] text-[var(--text-secondary)] opacity-60">
                                            {t('lastUpdated')}: {new Date(readonlyRate.effective_from).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </p>
                                    </>
                                ) : (
                                    <div className="w-5 h-5 border-2 border-white/20 border-t-[var(--accent-blue)] rounded-full animate-spin" />
                                )}
                            </div>
                        )}

                        {/* ── BUSINESS CONFIGURATION SUB-TABS (Admin Only) ── */}
                        {activeTab === 'biz_identity' && isAdmin && (
                            <div className="h-full pr-1">
                                <RestaurantSettingsForm mode="manage" activeSection="identity" />
                            </div>
                        )}

                        {activeTab === 'biz_address' && isAdmin && (
                            <div className="h-full pr-1">
                                <RestaurantSettingsForm mode="manage" activeSection="address" />
                            </div>
                        )}

                        {activeTab === 'biz_branding' && isAdmin && (
                            <div className="h-full pr-1">
                                <RestaurantSettingsForm mode="manage" activeSection="branding" />
                            </div>
                        )}


                        {activeTab === 'biz_operational' && isAdmin && (
                            <div className="h-full pr-1">
                                <RestaurantSettingsForm mode="manage" activeSection="operational" />
                            </div>
                        )}

                        {activeTab === 'biz_sync' && isAdmin && user?.restaurant_id && (
                            <div className="h-full pr-1">
                                <CloudResetDialog restaurantId={user.restaurant_id} />
                            </div>
                        )}
                    </div>
                </div>
            </div>


            {errorToast && (
                <Toast
                    message={errorToast}
                    variant="error"
                    onClose={() => setErrorToast(null)}
                />
            )}
        </div>
    );
}
