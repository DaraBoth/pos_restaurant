'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw, CheckCircle2, ArrowUpCircle } from 'lucide-react';

type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'ready';

export function UpdateStatus() {
    const [state, setState] = useState<UpdateState>('idle');
    const [latestVersion, setLatestVersion] = useState('');
    const [downloaded, setDownloaded] = useState(0);
    const [contentLength, setContentLength] = useState(0);
    const [pendingUpdate, setPendingUpdate] = useState<any>(null);
    const [dismissed, setDismissed] = useState('');

    const progressPct = useMemo(() => {
        if (!contentLength) return 0;
        return Math.min(100, Math.round((downloaded / contentLength) * 100));
    }, [downloaded, contentLength]);

    useEffect(() => {
        let cancelled = false;

        async function check() {
            if (typeof window === 'undefined') return;
            try {
                const { check: checkUpdate } = await import('@tauri-apps/plugin-updater');
                const update = await checkUpdate();
                if (cancelled) return;
                if (update) {
                    const ver = update.version || 'latest';
                    setLatestVersion(ver);
                    setPendingUpdate(update);
                    if (dismissed !== ver) setState('available');
                } else {
                    setState('idle');
                }
            } catch {
                // silently ignore — no release published yet
                if (!cancelled) setState('idle');
            }
        }

        check();
        const timer = setInterval(check, 10 * 60 * 1000);
        return () => { cancelled = true; clearInterval(timer); };
    }, [dismissed]);

    async function install() {
        if (!pendingUpdate) return;
        setState('downloading');
        setDownloaded(0);
        setContentLength(0);
        try {
            await pendingUpdate.downloadAndInstall((event: any) => {
                if (event.event === 'Started') setContentLength(event.data?.contentLength || 0);
                if (event.event === 'Progress') setDownloaded(p => p + (event.data?.chunkLength || 0));
            });
            setState('ready');
            const { relaunch } = await import('@tauri-apps/plugin-process');
            await relaunch();
        } catch {
            setState('available');
        }
    }

    // Nothing to show when idle / no update
    if (state === 'idle' || state === 'checking') return null;

    if (state === 'available') {
        return (
            <button
                onClick={install}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl border transition-all group"
                style={{ background: '#f59e0b12', borderColor: '#f59e0b40' }}
                title={`Update to v${latestVersion}`}
            >
                <span className="relative flex-shrink-0">
                    <span className="block w-2 h-2 rounded-full bg-amber-400" />
                    <span className="absolute inset-0 rounded-full bg-amber-400 opacity-50 animate-ping" />
                </span>
                <ArrowUpCircle size={12} className="text-amber-400 flex-shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 flex-1 text-left truncate">
                    Update v{latestVersion}
                </span>
                <Download size={11} className="text-amber-400/70 group-hover:text-amber-300 flex-shrink-0" />
            </button>
        );
    }

    if (state === 'downloading') {
        return (
            <div
                className="w-full px-2.5 py-2 rounded-xl border space-y-1.5"
                style={{ background: '#3b82f612', borderColor: '#3b82f640' }}
            >
                <div className="flex items-center gap-2">
                    <RefreshCw size={12} className="text-blue-400 animate-spin flex-shrink-0" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                        Installing... {progressPct}%
                    </span>
                </div>
                <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                    <div
                        className="h-full bg-blue-400 transition-all duration-150"
                        style={{ width: `${progressPct}%` }}
                    />
                </div>
            </div>
        );
    }

    if (state === 'ready') {
        return (
            <div
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl border"
                style={{ background: '#22c55e12', borderColor: '#22c55e40' }}
            >
                <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                    Restarting…
                </span>
            </div>
        );
    }

    return null;
}
