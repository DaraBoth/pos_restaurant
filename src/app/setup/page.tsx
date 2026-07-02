'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import RestaurantSettingsForm from '@/components/management/RestaurantSettingsForm';
import { useLanguage } from '@/providers/LanguageProvider';
import { useAuth } from '@/providers/AuthProvider';
import { setExchangeRate } from '@/lib/api/system';
import { ArrowRightLeft, Check } from 'lucide-react';

export default function SetupPage() {
    const router = useRouter();
    const { lang, setLang, t } = useLanguage();
    const { user } = useAuth();

    const [rateInput, setRateInput] = useState('');
    const [savingRate, setSavingRate] = useState(false);
    const [rateSaved, setRateSaved] = useState(false);

    async function handleSaveRate() {
        const rate = parseFloat(rateInput);
        if (!(rate > 0)) return;
        if (!user?.restaurant_id) return;
        setSavingRate(true);
        try {
            await setExchangeRate(rate, user.restaurant_id);
            setRateSaved(true);
        } catch (e) {
            console.error('Failed to set exchange rate during setup:', e);
        } finally {
            setSavingRate(false);
        }
    }

    return (
        <div className="min-h-screen bg-[var(--bg-dark)] px-6 py-10">
            {/* Language toggle — critical for first-run UX */}
            <div className="flex justify-end mb-4">
                <div className="flex gap-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-1">
                    <button
                        onClick={() => setLang('en')}
                        className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                            lang === 'en'
                                ? 'bg-[var(--accent-blue)] text-white'
                                : 'text-[var(--text-secondary)] hover:text-[var(--foreground)]'
                        }`}
                    >
                        EN
                    </button>
                    <button
                        onClick={() => setLang('km')}
                        className={`px-3 py-1 rounded-lg text-xs font-black transition-all khmer ${
                            lang === 'km'
                                ? 'bg-[var(--accent-blue)] text-white'
                                : 'text-[var(--text-secondary)] hover:text-[var(--foreground)]'
                        }`}
                    >
                        ភាសាខ្មែរ
                    </button>
                </div>
            </div>

            {/* Onboarding: prompt the owner to set the USD↔KHR rate so KHR prices are correct. */}
            <div className="max-w-2xl mx-auto mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="flex items-center gap-2 mb-1">
                    <ArrowRightLeft size={15} className="text-amber-400" />
                    <h3 className="text-sm font-black text-[var(--foreground)] uppercase tracking-widest">{t('exchangeRate')}</h3>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mb-3">{t('setupRatePrompt')}</p>
                <div className="flex items-center gap-2">
                    <div className="relative flex-1 max-w-[220px]">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--text-secondary)]">1 USD =</span>
                        <input
                            type="number"
                            min="0"
                            step="1"
                            value={rateInput}
                            onChange={e => { setRateInput(e.target.value); setRateSaved(false); }}
                            placeholder="4100"
                            className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl pl-[4.5rem] pr-3 py-2.5 text-[var(--foreground)] font-mono font-bold focus:border-[var(--accent)] outline-none transition-all"
                        />
                    </div>
                    <span className="text-sm font-bold text-[var(--text-secondary)]">៛</span>
                    <button
                        type="button"
                        onClick={handleSaveRate}
                        disabled={savingRate || !(parseFloat(rateInput) > 0)}
                        className="px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white text-xs font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 flex items-center gap-1.5"
                    >
                        {rateSaved ? <Check size={14} /> : null}
                        {rateSaved ? t('done') : t('setRate')}
                    </button>
                </div>
            </div>

            <RestaurantSettingsForm mode="setup" onNext={() => router.replace('/pos/tables')} />
        </div>
    );
}
