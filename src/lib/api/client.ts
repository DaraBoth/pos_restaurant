// Tauri IPC client — lazy-loads invoke() when running in desktop context

let invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

if (typeof window !== 'undefined') {
    import('@tauri-apps/api/core').then((m) => {
        invoke = m.invoke;
    });
}

export async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    if (typeof invoke === 'undefined') {
        throw new Error('Tauri not available — running outside of desktop app.');
    }
    return invoke<T>(cmd, args);
}
