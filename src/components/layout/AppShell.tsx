'use client';
import { usePathname } from 'next/navigation';
import DashboardShell from './DashboardShell';

const NO_SHELL_PREFIXES = ['/login', '/setup', '/super-admin'];

export default function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    // Strip trailing slash for consistent matching (trailingSlash: true in next.config)
    const normalised = pathname.replace(/\/$/, '') || '/';

    const isDashboard = normalised !== '/' &&
        !NO_SHELL_PREFIXES.some(p => normalised === p || normalised.startsWith(p + '/'));

    if (isDashboard) {
        return <DashboardShell>{children}</DashboardShell>;
    }

    return <>{children}</>;
}
