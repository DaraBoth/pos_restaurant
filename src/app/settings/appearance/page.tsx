'use client';

import { useState } from 'react';
import { useAuth, getSessionTimeoutMs, SESSION_TIMEOUT_KEY } from '@/providers/AuthProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { CustomSelect } from '@/components/ui/CustomSelect';
import SettingsSection from '../SettingsSection';

export default function AppearanceSettingsPage() {
    const { user } = useAuth();
    const { t, lang, setLang } = useLanguage();
    const { theme, setTheme } = useTheme();
    const [sessionTimeoutMs, setSessionTimeoutMs] = useState<number>(() => getSessionTimeoutMs());

    const isAdmin = user?.role === 'admin';
    const labelClass = 'block text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]';

    return (
        <SettingsSection title={t('settingsAppearanceHeader')} description={t('settingsAppearanceDesc')}>
            <div className="max-w-md space-y-6">
                <div className="space-y-2">
                    <label className={labelClass}>{t('themeMode')}</label>
                    <CustomSelect
                        value={theme}
                        onChange={(val) => setTheme(val as 'light' | 'dark')}
                        options={[
                            { label: t('darkModeLabel'), value: 'dark' },
                            { label: t('lightModeLabel'), value: 'light' },
                        ]}
                    />
                </div>

                <div className="space-y-2">
                    <label className={labelClass}>{t('interfaceLanguage')}</label>
                    <CustomSelect
                        value={lang}
                        onChange={(val) => setLang(val as 'en' | 'km')}
                        options={[
                            { label: 'English (US)', value: 'en' },
                            { label: 'ភាសាខ្មែរ (Khmer)', value: 'km' },
                        ]}
                    />
                </div>

                {isAdmin && (
                    <div className="space-y-2">
                        <label className={labelClass}>{t('sessionTimeout')}</label>
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
        </SettingsSection>
    );
}
