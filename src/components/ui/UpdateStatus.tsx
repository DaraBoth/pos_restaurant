'use client';

import type { Update, DownloadEvent } from '@tauri-apps/plugin-updater';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    Download, RefreshCw, CheckCircle2, ArrowUpCircle, Clock, X,
} from 'lucide-react';
import { useLanguage } from '@/providers/LanguageProvider';

type UpdateState =
    | 'idle'
    | 'checking'
    | 'available'
    | 'downloading'
    | 'installed'        // binary swapped on disk, user choosing restart-now vs later
    | 'pending-restart'; // user chose "Later"; sidebar shows reminder pill

export function UpdateStatus() {
    const { t } = useLanguage();
    const [state, setState] = useState<UpdateState>('idle');
    const [latestVersion, setLatestVersion] = useState('');
    const [downloaded, setDownloaded] = useState(0);
    const [contentLength, setContentLength] = useState(0);
    const [pendingUpdate, setPendingUpdate] = useState<Update | null>(null);
    const [dismissed, setDismissed] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [sizeHint, setSizeHint] = useState('');

    // Snapshot of state for use inside the polling callback — avoids stale-closure
    // bugs when the interval fires while we're already mid-install.
    const stateRef = useRef<UpdateState>(state);
    useEffect(() => { stateRef.current = state; }, [state]);

    // Version that's been installed on disk and is waiting for the user to restart.
    // Used so a follow-up poll doesn't re-prompt for the same version.
    const installedVersionRef = useRef<string>('');

    // Interval handle — stored in a ref so install() can stop polling after success.
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

                    // Same version that's already installed and awaiting restart — quiet.
                    if (stateRef.current === 'pending-restart' && installedVersionRef.current === ver) {
                        console.info(`[Updater] v${ver} already installed; awaiting user restart`);
                        return;
                    }

                    // Don't clobber an in-flight download or the install-complete modal.
                    if (stateRef.current === 'downloading' || stateRef.current === 'installed') {
                        return;
                    }

                    console.info(`[Updater] new version available: ${ver}`);
                    setLatestVersion(ver);
                    setPendingUpdate(update);
                    if (dismissed !== ver) setState('available');
                } else {
                    console.info('[Updater] already on the latest version');
                    // Don't drop the pending-restart pill just because the running
                    // version still sees an update available — that's expected
                    // (running process is still on the old binary in memory).
                    if (stateRef.current !== 'pending-restart' && stateRef.current !== 'installed') {
                        setState('idle');
                    }
                }
            } catch (err) {
                if (!cancelled) {
                    console.warn('[Updater] check failed:', err);
                    if (stateRef.current !== 'pending-restart' && stateRef.current !== 'installed') {
                        setState('idle');
                    }
                }
            }
        }

        check();
        timerRef.current = setInterval(check, 10 * 60 * 1000);
        return () => {
            cancelled = true;
            if (timerRef.current !== null) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [dismissed]);

    async function install() {
        if (!pendingUpdate) return;
        setState('downloading');
        setDownloaded(0);
        setContentLength(0);
        setErrorMsg('');
        setSizeHint('');
        try {
            await pendingUpdate.downloadAndInstall((event: DownloadEvent) => {
                if (event.event === 'Started') {
                    const bytes = event.data?.contentLength;
                    setContentLength(bytes || 0);
                    if (bytes) setSizeHint(Math.round(bytes / 1024 / 1024) + ' MB');
                }
                if (event.event === 'Progress') setDownloaded(p => p + (event.data?.chunkLength || 0));
            });
            console.info(`[Updater] v${latestVersion} installed on disk; prompting for restart`);
            installedVersionRef.current = latestVersion;
            setState('installed');
            if (timerRef.current !== null) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        } catch (err) {
            console.error('[Updater] install failed:', err);
            setState('available');
            setErrorMsg('Download failed. Tap to retry.');
        }
    }

    async function restartNow() {
        try {
            const { relaunch } = await import('@tauri-apps/plugin-process');
            await relaunch();
        } catch (err) {
            console.error('[Updater] relaunch failed:', err);
        }
    }

    function restartLater() {
        // Binary is already on disk — next normal app launch will pick it up.
        // We keep a sidebar pill so the user remembers a restart is pending.
        setState('pending-restart');
    }

    // ─── Sidebar pill (renders inline where UpdateStatus is mounted) ──────────

    let pill: React.ReactElement | null = null;

    if (state === 'available') {
        pill = (
            <div className="w-full space-y-1">
                <div
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl border transition-all group"
                    style={{ background: '#f59e0b12', borderColor: '#f59e0b40' }}
                >
                    <button
                        type="button"
                        onClick={install}
                        className="flex items-center gap-2 flex-1 min-w-0"
                        title={`Update to v${latestVersion}`}
                    >
                        <span className="relative flex-shrink-0">
                            <span className="block w-2 h-2 rounded-full bg-amber-400" />
                            <span className="absolute inset-0 rounded-full bg-amber-400 opacity-50 animate-ping" />
                        </span>
                        <ArrowUpCircle size={12} className="text-amber-400 flex-shrink-0" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 flex-1 text-left truncate">
                            {t('updateAvailable')}{latestVersion}
                        </span>
                        <Download size={11} className="text-amber-400/70 group-hover:text-amber-300 flex-shrink-0" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setDismissed(latestVersion)}
                        className="ml-0.5 p-0.5 rounded text-amber-400/60 hover:text-amber-300 hover:bg-amber-400/10 transition-colors flex-shrink-0"
                        title="Dismiss"
                        aria-label="Dismiss update"
                    >
                        <X size={10} />
                    </button>
                </div>
                {errorMsg && (
                    <p className="text-[9px] text-red-400 px-1">{errorMsg}</p>
                )}
            </div>
        );
    } else if (state === 'downloading') {
        pill = (
            <div
                className="w-full px-2.5 py-2 rounded-xl border space-y-1.5"
                style={{ background: '#3b82f612', borderColor: '#3b82f640' }}
            >
                <div className="flex items-center gap-2">
                    <RefreshCw size={12} className="text-blue-400 animate-spin flex-shrink-0" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                        {t('downloading')} {progressPct}%{sizeHint ? ` of ${sizeHint}` : ''}
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
    } else if (state === 'pending-restart') {
        pill = (
            <button
                onClick={restartNow}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl border transition-all group"
                style={{ background: '#22c55e12', borderColor: '#22c55e40' }}
                title={`Restart now to apply v${latestVersion}`}
            >
                <Clock size={12} className="text-emerald-400 flex-shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex-1 text-left truncate">
                    {t('restartFor')}{latestVersion}
                </span>
                <RefreshCw size={11} className="text-emerald-400/70 group-hover:text-emerald-300 flex-shrink-0" />
            </button>
        );
    }

    // ─── Install-complete modal (portaled to <body> so it overlays everything) ─

    const modal =
        state === 'installed' && typeof document !== 'undefined'
            ? createPortal(
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                                <CheckCircle2 size={22} className="text-emerald-400" />
                            </div>
                            <div>
                                <h2 className="text-sm font-black text-[var(--foreground)] uppercase tracking-widest">
                                    {t('updateReady')}
                                </h2>
                                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                                    v{latestVersion} downloaded and installed
                                </p>
                            </div>
                        </div>
                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                            {t('updateReadyBody')}
                        </p>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={restartLater}
                                className="flex-1 py-3 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-white/5 transition-colors text-sm font-black uppercase tracking-widest"
                            >
                                {t('later')}
                            </button>
                            <button
                                type="button"
                                onClick={restartNow}
                                className="flex-1 py-3 rounded-xl bg-emerald-500 text-black hover:bg-emerald-400 transition-colors text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-[0.98]"
                            >
                                <RefreshCw size={14} strokeWidth={3} /> {t('restartNow')}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body,
            )
            : null;

    return (
        <>
            {pill}
            {modal}
        </>
    );
}
