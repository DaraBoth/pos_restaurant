'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type Theme = 'dark' | 'light';

interface ThemeContextValue {
    theme: Theme;
    setTheme: (t: Theme) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
    theme: 'dark',
    setTheme: () => {},
    toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>('dark');

    useEffect(() => {
        const stored = localStorage.getItem('dineos_theme') as Theme | null;
        const resolved = stored === 'light' || stored === 'dark' ? stored : 'dark';
        setThemeState(resolved);
        document.documentElement.setAttribute('data-theme', resolved);
    }, []);

    const setTheme = useCallback((t: Theme) => {
        setThemeState(t);
        localStorage.setItem('dineos_theme', t);
        document.documentElement.setAttribute('data-theme', t);
    }, []);

    const toggleTheme = useCallback(() => {
        setThemeState(prev => {
            const next = prev === 'dark' ? 'light' : 'dark';
            localStorage.setItem('dineos_theme', next);
            document.documentElement.setAttribute('data-theme', next);
            return next;
        });
    }, []);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);
