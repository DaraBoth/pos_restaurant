'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw, X, CheckCircle2 } from 'lucide-react';

type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';

export default function AppUpdater() {
    const [state, setState] = useState<UpdateState>('idle');
    const [error, setError] = useState('');
    const [dismissedVersion, setDismissedVersion] = useState<string>('');
    const [latestVersion, setLatestVersion] = useState('');
    const [downloaded, setDownloaded] = useState(0);
    const [contentLength, setContentLength] = useState(0);
    const [pendingUpdate, setPendingUpdate] = useState<any>(null);

    const progressPct = useMemo(() => {
        if (!contentLength) {
            return 0;
        }
        return Math.min(100, Math.round((downloaded / contentLength) * 100));
    }, [downloaded, contentLength]);

    useEffect(() => {
        let cancelled = false;
        let timer: ReturnType<typeof setInterval> | null = null;

        async function checkForUpdates() {
            if (typeof window === 'undefined') {
                return;
            }

            setError('');
            setState(prev => (prev === 'downloading' ? prev : 'checking'));

            try {
                const { check } = await import('@tauri-apps/plugin-updater');

                const update = await check();
                if (cancelled) {
                    return;
                }

                if (update) {
                    const nextVersion = update.version || 'latest';
                    setLatestVersion(nextVersion);
                    setPendingUpdate(update);
                    if (dismissedVersion !== nextVersion) {
                        setState('available');
                    } else {
                        setState('idle');
                    }
                } else {
                    setState('idle');
                    setPendingUpdate(null);
                }
            } catch (err: any) {
                // Silently ignore update check errors (e.g. no release published yet).
                // This avoids showing a confusing toast during dev or early production.
                if (!cancelled) {
                    setState('idle');
                    console.warn('[AppUpdater] Update check failed:', err?.message || err);
                }
            }
        }

        checkForUpdates();
        timer = setInterval(checkForUpdates, 10 * 60 * 1000);

        return () => {
            cancelled = true;
            if (timer) {
                clearInterval(timer);
            }
        };
    }, [dismissedVersion]);

    async function downloadAndRestart() {
        if (!pendingUpdate) {
            return;
        }

        setState('downloading');
        setError('');
        setDownloaded(0);
        setContentLength(0);

        try {
            await pendingUpdate.downloadAndInstall((event: any) => {
                if (event.event === 'Started') {
                    setContentLength(event.data?.contentLength || 0);
                    setDownloaded(0);
                }
                if (event.event === 'Progress') {
                    const chunk = event.data?.chunkLength || 0;
                    setDownloaded(prev => prev + chunk);
                }
                if (event.event === 'Finished') {
                    setDownloaded(prev => prev);
                }
            });

            setState('ready');

            const { relaunch } = await import('@tauri-apps/plugin-process');
            await relaunch();
        } catch (err: any) {
            setState('error');
            setError(err?.message || String(err));
        }
    }

    if (state === 'idle' || state === 'checking') {
        return null;
    }

    if (state === 'error') {
        return (
            <div className="fixed right-4 bottom-4 z-[70] w-[360px] rounded-2xl border border-orange-500/30 bg-[#181214] shadow-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-black uppercase tracking-widest text-orange-300">Update Check Failed</p>
                    <button
                        className="p-1 rounded hover:bg-white/10 text-white/70"
                        onClick={() => setState('idle')}
                    >
                        <X size={14} />
                    </button>
                </div>
                <p className="text-xs text-orange-100/80">{error || 'Could not check for updates.'}</p>
            </div>
        );
    }

    return (
        <div className="fixed right-4 bottom-4 z-[70] w-[380px] rounded-2xl border border-emerald-500/30 bg-[#10161a] shadow-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-widest text-emerald-300">
                    {state === 'downloading' ? 'Downloading Update' : 'Update Available'}
                </p>
                <button
                    className="p-1 rounded hover:bg-white/10 text-white/70"
                    onClick={() => {
                        setDismissedVersion(latestVersion);
                        setState('idle');
                    }}
                    disabled={state === 'downloading'}
                    title="Dismiss"
                >
                    <X size={14} />
                </button>
            </div>

            <p className="text-sm text-white">
                New version <span className="font-black text-emerald-300">{latestVersion}</span>
                {' is ready.'}
            </p>

            {state === 'downloading' && (
                <div className="space-y-2">
                    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                            className="h-full bg-emerald-400 transition-all duration-150"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                    <p className="text-[11px] text-white/70">{progressPct}% downloaded</p>
                </div>
            )}

            {state === 'ready' ? (
                <div className="flex items-center gap-2 text-emerald-300 text-sm font-semibold">
                    <CheckCircle2 size={16} /> Restarting to apply update...
                </div>
            ) : (
                <button
                    onClick={downloadAndRestart}
                    disabled={state === 'downloading'}
                    className="w-full py-2.5 rounded-xl bg-emerald-500 text-black font-black text-xs uppercase tracking-widest hover:brightness-110 disabled:opacity-60 transition-all flex items-center justify-center gap-2"
                >
                    {state === 'downloading' ? (
                        <>
                            <RefreshCw size={14} className="animate-spin" /> Installing...
                        </>
                    ) : (
                        <>
                            <Download size={14} /> Update And Restart
                        </>
                    )}
                </button>
            )}
        </div>
    );
}
