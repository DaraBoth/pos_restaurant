'use client';

import { useRouter } from 'next/navigation';
import RestaurantSettingsForm from '@/components/management/RestaurantSettingsForm';
import { useLanguage } from '@/providers/LanguageProvider';

export default function SetupPage() {
    const router = useRouter();
    const { lang, setLang } = useLanguage();

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
            <RestaurantSettingsForm mode="setup" onNext={() => router.replace('/pos/tables')} />
        </div>
    );
}
