// Tauri IPC client — shared invoke Promise, loaded once at module init time.
// A single cached Promise means all concurrent callers on first load share
// the same in-flight import rather than each triggering a new module load.

type InvokeFn = typeof import('@tauri-apps/api/core')['invoke'];
let _invokePromise: Promise<InvokeFn> | null = null;

function getInvoke(): Promise<InvokeFn> {
    if (!_invokePromise) {
        _invokePromise = import('@tauri-apps/api/core').then(m => m.invoke);
    }
    return _invokePromise;
}

// Kick off the module load immediately when this file is first imported.
// Since login/page imports tauri-commands which imports client.ts, the bridge
// starts loading while the user reads the login form — before any IPC call.
if (typeof window !== 'undefined') {
    getInvoke().catch(() => { /* not in Tauri env */ });
}

export async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    if (typeof window === 'undefined') {
        throw new Error('Tauri not available — server-side rendering.');
    }
    let invoke: InvokeFn;
    try {
        invoke = await getInvoke();
    } catch {
        throw new Error('Analytics unavailable outside Tauri desktop app.');
    }
    // Let the actual invoke error propagate naturally so we see the real error
    return invoke<T>(cmd, args);
}
