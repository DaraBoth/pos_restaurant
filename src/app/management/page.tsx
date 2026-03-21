'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLanguage } from '@/providers/LanguageProvider';
import {
    LayoutDashboard, TrendingUp, Package, LayoutGrid,
    Users, RefreshCw, ClipboardList, Building2, Layers, BoxesIcon
} from 'lucide-react';
import type { TranslationKey } from '@/lib/i18n';

// ── Sub-view components (imported statically — no lazy chunk loading) ──
import DashboardView from './views/DashboardView';
import AnalyticsView from './views/AnalyticsView';
import ProductsView from './views/ProductsView';
import TablesView from './views/TablesView';
import UsersView from './views/UsersView';
import ExchangeRateView from './views/ExchangeRateView';
import OrdersView from './views/OrdersView';
import SettingsView from './views/SettingsView';
import CategoriesView from './views/CategoriesView';
import InventoryView from './views/InventoryView';

type Tab = 'dashboard' | 'analytics' | 'products' | 'categories' | 'tables' | 'users' | 'exchange-rate' | 'orders' | 'inventory' | 'settings';

const TABS: { id: Tab; labelKey: TranslationKey; icon: any }[] = [
    { id: 'dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
    { id: 'analytics', labelKey: 'analytics', icon: TrendingUp },
    { id: 'products', labelKey: 'products', icon: Package },
    { id: 'categories', labelKey: 'categories', icon: Layers },
    { id: 'inventory', labelKey: 'inventory', icon: BoxesIcon },
    { id: 'tables', labelKey: 'floorPlan', icon: LayoutGrid },
    { id: 'users', labelKey: 'users', icon: Users },
    { id: 'exchange-rate', labelKey: 'exchangeRate', icon: RefreshCw },
    { id: 'orders', labelKey: 'orderHistory', icon: ClipboardList },
    { id: 'settings', labelKey: 'settings', icon: Building2 },
];

const TAB_COMPONENTS: Record<Tab, React.FC> = {
    dashboard: DashboardView,
    analytics: AnalyticsView,
    products: ProductsView,
    categories: CategoriesView,
    inventory: InventoryView,
    tables: TablesView,
    users: UsersView,
    'exchange-rate': ExchangeRateView,
    orders: OrdersView,
    settings: SettingsView,
};

export default function ManagementPage() {
    return (
        <Suspense>
            <ManagementContent />
        </Suspense>
    );
}

function ManagementContent() {
    const [activeTab, setActiveTab] = useState<Tab>('dashboard');
    const { t } = useLanguage();
    const searchParams = useSearchParams();

    useEffect(() => {
        const tab = searchParams.get('tab') as Tab | null;
        if (tab && tab in TAB_COMPONENTS) setActiveTab(tab);
    }, [searchParams]);

    const ActiveComponent = TAB_COMPONENTS[activeTab];

    return (
        <>
            {/* Horizontal tab bar */}
            <header className="flex-shrink-0 bg-[var(--bg-card)] border-b border-[var(--border)] overflow-x-auto no-scrollbar">
                <nav className="px-3 flex items-center h-11 gap-0.5 min-w-max">
                    {TABS.map(({ id, labelKey, icon: Icon }) => {
                        const active = activeTab === id;
                        return (
                            <button
                                key={id}
                                onClick={() => setActiveTab(id)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap active:scale-95 ${active
                                        ? 'bg-[var(--accent-blue)] text-white'
                                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--foreground)]'
                                    }`}
                            >
                                <Icon size={13} strokeWidth={active ? 2.5 : 2} />
                                <span>{t(labelKey)}</span>
                            </button>
                        );
                    })}
                </nav>
            </header>

            {/* Content area */}
            <main className="flex-1 overflow-y-auto p-4 min-w-0 no-scrollbar bg-[var(--bg-dark)]">
                <div className="max-w-7xl mx-auto h-full">
                    <ActiveComponent />
                </div>
            </main>
        </>
    );
}
