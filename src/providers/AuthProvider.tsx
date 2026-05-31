'use client';
import React, { createContext, useContext, useState, useCallback } from 'react';
import { UserSession } from '@/lib/tauri-commands';
import { normalizeRole } from '@/lib/permissions';

interface AuthContextValue {
    user: UserSession | null;
    setUser: (u: UserSession | null) => void;
    isAuthenticated: boolean;
    loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
    user: null,
    setUser: () => { },
    isAuthenticated: false,
    loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUserState] = useState<UserSession | null>(null);
    const [loading, setLoading] = useState(true);

    React.useEffect(() => {
        const saved = localStorage.getItem('dineos_session');
        if (saved) {
            try {
                const parsed = JSON.parse(saved) as UserSession;
                setUserState({ ...parsed, role: normalizeRole(parsed.role) });
            } catch (e) {
                console.error('Failed to parse saved session', e);
                localStorage.removeItem('dineos_session');
            }
        }
        setLoading(false);
    }, []);

    const setUser = useCallback((u: UserSession | null) => {
        const normalized = u ? { ...u, role: normalizeRole(u.role) } : null;
        setUserState(normalized);
        if (u) {
            localStorage.setItem('dineos_session', JSON.stringify(normalized));
        } else {
            localStorage.removeItem('dineos_session');
        }
    }, []);

    return (
        <AuthContext.Provider value={{ user, setUser, isAuthenticated: !!user, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
