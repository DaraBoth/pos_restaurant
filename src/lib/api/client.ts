// Tauri IPC client — awaits invoke() on every call (module is cached after first import)

export async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    if (typeof window === 'undefined') {
        throw new Error('Tauri not available — server-side rendering.');
    }
    try {
        const { invoke } = await import('@tauri-apps/api/core');
        return invoke<T>(cmd, args);
    } catch {
        throw new Error('Tauri not available — running outside of desktop app.');
    }
}
