'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations, Lang, TranslationKey } from '@/lib/i18n';

interface LanguageContextValue {
    lang: Lang;
    setLang: (l: Lang) => void;
    t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
    lang: 'en',
    setLang: () => { },
    t: (k) => k,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [lang, setLangState] = useState<Lang>('en');

    useEffect(() => {
        const stored = localStorage.getItem('khpos_lang') as Lang | null;
        if (stored === 'km' || stored === 'en') setLangState(stored);
    }, []);

    const setLang = useCallback((l: Lang) => {
        setLangState(l);
        localStorage.setItem('khpos_lang', l);
    }, []);

    const t = useCallback(
        (key: TranslationKey): string => translations[lang][key] as string ?? key,
        [lang]
    );

    return (
        <LanguageContext.Provider value={{ lang, setLang, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export const useLanguage = () => useContext(LanguageContext);
