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
    if (normalized === 'super_admin') return 'Super Admin';
    if (normalized === 'admin') return 'Admin';
    if (normalized === 'business_admin') return 'Manager';
    if (normalized === 'cashier') return 'Cashier';
    return 'Staff';
}

export function canApplyDiscount(role: string | null | undefined): boolean {
    const normalized = normalizeRole(role);
    return normalized === 'super_admin' || normalized === 'admin' || normalized === 'business_admin';
}

export function canVoidOrder(role: string | null | undefined): boolean {
    const normalized = normalizeRole(role);
    return normalized === 'super_admin' || normalized === 'admin' || normalized === 'business_admin';
}

export function canCloseShiftReport(role: string | null | undefined): boolean {
    const normalized = normalizeRole(role);
    return normalized === 'super_admin' || normalized === 'admin' || normalized === 'business_admin';
}

export function canEditPrice(role: string | null | undefined): boolean {
    const normalized = normalizeRole(role);
    return normalized === 'super_admin' || normalized === 'admin';
}

import type { TranslationKey } from '@/lib/i18n';

export function roleI18nKey(role: string | null | undefined): TranslationKey {
    const normalized = normalizeRole(role);
    if (normalized === 'super_admin') return 'roleSuperAdmin';
    if (normalized === 'admin') return 'roleAdmin';
    if (normalized === 'business_admin') return 'roleManager';
    if (normalized === 'cashier') return 'roleCashier';
    return 'roleStaff';
}
