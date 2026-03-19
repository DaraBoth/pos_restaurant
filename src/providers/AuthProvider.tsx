'use client';
import React, { createContext, useContext, useState, useCallback } from 'react';
import { UserSession } from '@/lib/tauri-commands';

interface AuthContextValue {
    user: UserSession | null;
    setUser: (u: UserSession | null) => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue>({
    user: null,
    setUser: () => { },
    isAuthenticated: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUserState] = useState<UserSession | null>(null);

    const setUser = useCallback((u: UserSession | null) => {
        setUserState(u);
    }, []);

    return (
        <AuthContext.Provider value={{ user, setUser, isAuthenticated: !!user }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
