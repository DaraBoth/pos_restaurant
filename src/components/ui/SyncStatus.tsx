'use client';
/**
 * SyncStatus — shows cloud sync state in the sidebar.
 *
 * States
 *   offline  → no internet (navigator.onLine = false)
 *   syncing  → a write just happened; waiting for confirmation
 *   synced   → DB connected and data is current
 *   local    → no DATABASE_URL configured; local-only mode
 *
 * Other parts of the app can trigger the "syncing" pulse by dispatching:
 *   window.dispatchEvent(new CustomEvent('dineos:sync-start'))
 * and clearing it with:
 *   window.dispatchEvent(new CustomEvent('dineos:sync-end'))
 */
import { useEffect, useState, useRef } from 'react';
import { getDbStatus } from '@/lib/tauri-commands';
import { Cloud, CloudOff, CloudUpload, Check } from 'lucide-react';

type SyncState = 'offline' | 'syncing' | 'synced' | 'local' | 'error';

const CONFIG: Record<SyncState, { icon: React.ElementType; label: string; color: string; pulse: boolean }> = {
    offline: { icon: CloudOff,    label: 'Offline',    color: '#ef4444', pulse: false },
    syncing: { icon: CloudUpload, label: 'Syncing…',   color: '#f59e0b', pulse: true  },
    synced:  { icon: Check,       label: 'Up to date', color: '#22c55e', pulse: false },
    local:   { icon: Cloud,       label: 'Local mode', color: '#6b7280', pulse: false },
    error:   { icon: CloudOff,    label: 'Sync Error', color: '#f97316', pulse: false },
};

export function SyncStatus() {
    const [state, setState] = useState<SyncState>('synced');
    const [tooltip, setTooltip] = useState('Checking...');
    const syncingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    async function checkStatus() {
        // High-level check for browser's internet connectivity
        if (typeof window !== 'undefined' && !navigator.onLine) {
            setState('offline');
            return;
        }

        try {
            const status = await getDbStatus();
            setTooltip(status.error_message || `Last checked: ${new Date().toLocaleTimeString()}`);

            if (status.mode === 'local') {
                setState('local');
            } else if (status.connected) {
                // If we were in error state but now connected, clear it
                setState(prev => (prev === 'error' || prev === 'offline') ? 'synced' : prev);
            } else {
                // If we have internet but cloud is unreachable, it's a Sync Error
                setState('error');
            }
        } catch {
            // If the command itself fails, we are likely having network issues
            setState('offline');
            setTooltip('Failed to communicate with the database service');
        }
    }

    useEffect(() => {
        // Initial check
        checkStatus();

        // Poll every 10 seconds (increased from 30s to compensate for no event listeners)
        pollRef.current = setInterval(checkStatus, 10_000);

        // Browser online/offline events
        const goOffline = () => setState('offline');
        const goOnline  = () => checkStatus();
        window.addEventListener('offline', goOffline);
        window.addEventListener('online',  goOnline);

        // Custom events dispatched by write operations (local)
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

    return (
        <div
            className="flex items-center gap-2 px-2.5 py-2 rounded-xl border transition-all cursor-help"
            style={{
                background: `${cfg.color}12`,
                borderColor: `${cfg.color}30`,
            }}
            title={tooltip}
        >
            {/* Dot indicator */}
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
                {cfg.label}
            </span>
        </div>
    );
}
