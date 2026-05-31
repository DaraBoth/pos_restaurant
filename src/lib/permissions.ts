export type AppRole = 'super_admin' | 'admin' | 'business_admin' | 'cashier';

// Canonical role mapping for legacy records and backward-compatible UI checks.
export function normalizeRole(role: string | null | undefined): AppRole {
    const value = (role || '').trim().toLowerCase();

    if (value === 'super_admin') return 'super_admin';
    if (value === 'admin') return 'admin';
    if (value === 'business_admin' || value === 'manager') return 'business_admin';

    // Legacy operational roles map into cashier capabilities.
    if (value === 'cashier' || value === 'waiter' || value === 'chef') return 'cashier';

    return 'cashier';
}

export function canDelete(role: string | null | undefined): boolean {
    const normalized = normalizeRole(role);
    return normalized === 'super_admin' || normalized === 'admin';
}

export function canAccessAdminConsole(role: string | null | undefined): boolean {
    const normalized = normalizeRole(role);
    return normalized === 'super_admin' || normalized === 'admin' || normalized === 'business_admin';
}

export function canAccessAnalyticsDashboard(role: string | null | undefined): boolean {
    const normalized = normalizeRole(role);
    return normalized === 'super_admin' || normalized === 'admin' || normalized === 'business_admin';
}

export function roleLabel(role: string | null | undefined): string {
    const normalized = normalizeRole(role);
    if (normalized === 'super_admin') return 'super_admin';
    if (normalized === 'business_admin') return 'business_admin';
    return normalized;
}
