'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { getExchangeRate } from '@/lib/api/system';
import { formatKhr } from '@/lib/currency';
import type { ExchangeRate } from '@/types';
import ExchangeRateManagement from '@/components/management/ExchangeRateManagement';
import SettingsSection from '../../SettingsSection';

export default function BusinessExchangeRatePage() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const isAdmin = user?.role === 'admin';
    const [readonlyRate, setReadonlyRate] = useState<ExchangeRate | null>(null);

    useEffect(() => {
        if (!isAdmin && user?.restaurant_id) {
            getExchangeRate(user.restaurant_id).then(setReadonlyRate).catch(console.error);
        }
    }, [isAdmin, user?.restaurant_id]);

    return (
        <SettingsSection title={t('settingsExchangeHeader')} description={t('settingsExchangeDesc')}>
            {isAdmin ? (
                <ExchangeRateManagement />
            ) : (
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
                                <p className="text-[10px] text-[var(--text-secondary)] opacity-40 font-mono">
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
        </SettingsSection>
    );
}
