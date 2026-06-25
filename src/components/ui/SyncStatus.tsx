'use client';
import { useEffect, useState, useRef } from 'react';
import { getDbStatus } from '@/lib/tauri-commands';
import { useLanguage } from '@/providers/LanguageProvider';
import { Cloud, CloudOff, CloudUpload, Check } from 'lucide-react';

type SyncState = 'offline' | 'syncing' | 'synced' | 'local' | 'error';

const CONFIG: Record<SyncState, { icon: React.ElementType; color: string; pulse: boolean }> = {
    offline: { icon: CloudOff,    color: '#ef4444', pulse: false },
    syncing: { icon: CloudUpload, color: '#f59e0b', pulse: true  },
    synced:  { icon: Check,       color: '#22c55e', pulse: false },
    local:   { icon: Cloud,       color: '#6b7280', pulse: false },
    error:   { icon: CloudOff,    color: '#f97316', pulse: false },
};

function mapSyncErrorKey(msg: string): string {
    const lower = msg.toLowerCase();
    if (lower.includes('timeout') || lower.includes('connection') || lower.includes('network')) {
        return 'syncErrNetwork';
    }
    if (lower.includes('expired') || lower.includes('stream') || lower.includes('closed')) {
        return 'syncErrExpired';
    }
    if (lower.includes('unauthorized') || lower.includes('401') || lower.includes('forbidden') || lower.includes('403')) {
        return 'syncErrAuth';
    }
    return 'syncErrGeneral';
}

export function SyncStatus() {
    const [state, setState] = useState<SyncState>('synced');
    const [rawError, setRawError] = useState('');
    const [friendlyKey, setFriendlyKey] = useState('syncErrGeneral');
    const syncingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const { t } = useLanguage();

    const stateLabels: Record<SyncState, string> = {
        offline: t('syncOffline'),
        syncing: t('syncSyncing'),
        synced:  t('syncSynced'),
        local:   t('syncLocal'),
        error:   t('syncError'),
    };

    async function checkStatus() {
        if (typeof window !== 'undefined' && !navigator.onLine) {
            setState('offline');
            return;
        }

        try {
            const status = await getDbStatus();

            if (status.error_message) {
                const key = mapSyncErrorKey(status.error_message);
                setFriendlyKey(key);
                setRawError(status.error_message);
                if (!status.connected) {
                    console.error('[SyncStatus]', status.error_message);
                }
            } else {
                setRawError('');
                setFriendlyKey('syncErrGeneral');
            }

            if (status.mode === 'local') {
                setState('local');
            } else if (status.connected) {
                setState(prev => (prev === 'error' || prev === 'offline') ? 'synced' : prev);
            } else {
                setState('error');
            }
        } catch {
            setState('offline');
            setRawError('Failed to communicate with the database service');
            setFriendlyKey('syncErrNetwork');
        }
    }

    useEffect(() => {
        checkStatus();
        pollRef.current = setInterval(checkStatus, 10_000);

        const goOffline = () => setState('offline');
        const goOnline  = () => checkStatus();
        window.addEventListener('offline', goOffline);
        window.addEventListener('online',  goOnline);

        const startSync = () => {
            if (syncingTimerRef.current) clearTimeout(syncingTimerRef.current);
            setState('syncing');
        };
        const endSync = () => {
            syncingTimerRef.current = setTimeout(() => checkStatus(), 1500);
        };
        window.addEventListener('dineos:sync-start', startSync);
        window.addEventListener('dineos:sync-end',   endSync);

        return () => {
            if (pollRef.current)   clearInterval(pollRef.current);
            if (syncingTimerRef.current) clearTimeout(syncingTimerRef.current);
            window.removeEventListener('offline', goOffline);
            window.removeEventListener('online',  goOnline);
            window.removeEventListener('dineos:sync-start', startSync);
            window.removeEventListener('dineos:sync-end',   endSync);
        };
    }, []);

    const cfg = CONFIG[state];
    const Icon = cfg.icon;
    const label = stateLabels[state];
    const tooltipText = state === 'error' ? t(friendlyKey) : label;

    return (
        <div
            className="flex flex-col gap-0.5"
            title={tooltipText}
        >
            <div
                className="flex items-center gap-2 px-2.5 py-2 rounded-xl border transition-all cursor-help"
                style={{
                    background: `${cfg.color}12`,
                    borderColor: `${cfg.color}30`,
                }}
            >
                <span className="relative flex-shrink-0">
                    <span
                        className="block w-2 h-2 rounded-full"
                        style={{ background: cfg.color }}
                    />
                    {cfg.pulse && (
                        <span
                            className="absolute inset-0 rounded-full animate-ping"
                            style={{ background: cfg.color, opacity: 0.5 }}
                        />
                    )}
                </span>

                <Icon size={12} style={{ color: cfg.color }} strokeWidth={2.5} className="flex-shrink-0" />

                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: cfg.color }}>
                    {label}
                </span>
            </div>

            {state === 'error' && rawError && (
                <p className="text-[9px] text-[var(--text-secondary)] px-2.5 leading-relaxed opacity-70 truncate" title={t(friendlyKey)}>
                    {t(friendlyKey)}
                </p>
            )}
        </div>
    );
}
