'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLanguage } from '@/providers/LanguageProvider';
import { useAuth } from '@/providers/AuthProvider';
import {
    TrendingUp, Package, LayoutGrid,
    Users, ClipboardList, Layers, BoxesIcon, LayoutDashboard
} from 'lucide-react';
import type { TranslationKey } from '@/lib/i18n';
import { getRestaurant, Restaurant } from '@/lib/tauri-commands';

// ── Sub-view components (imported statically — no lazy chunk loading) ──
import AnalyticsView from './views/AnalyticsView';
import ProductsView from './views/ProductsView';
import TablesView from './views/TablesView';
import UsersView from './views/UsersView';
import OrdersView from './views/OrdersView';
import CategoriesView from './views/CategoriesView';
import InventoryView from './views/InventoryView';
import DashboardView from './views/DashboardView';

type Tab = 'dashboard' | 'analytics' | 'products' | 'categories' | 'tables' | 'users' | 'orders' | 'inventory';

// Business types that NEVER use tables (no seating/floor plan needed)
const NO_TABLE_TYPES = ['Mart/Accessories Shop/Pharmacy/Bakery'];

function needsTables(restaurant: Restaurant | null): boolean {
    if (!restaurant) return true; // default: show while loading
    const type = restaurant.business_type || 'Restaurant/Pub/Bar';
    if (NO_TABLE_TYPES.includes(type)) return false;
    // Coffee Shop can optionally disable tables
    if (type === 'Coffee Shop' && restaurant.disable_tables === 1) return false;
    return true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ALL_TABS: { id: Tab; labelKey: TranslationKey; icon: any }[] = [
    { id: 'dashboard',  labelKey: 'dashboard',      icon: LayoutDashboard },
    { id: 'analytics',  labelKey: 'analytics',     icon: TrendingUp },
    { id: 'categories', labelKey: 'categories',     icon: Layers },
    { id: 'products',   labelKey: 'products',        icon: Package },
    { id: 'inventory',  labelKey: 'inventory',       icon: BoxesIcon },
    { id: 'tables',     labelKey: 'floorPlan',       icon: LayoutGrid },
    { id: 'users',      labelKey: 'users',           icon: Users },
    { id: 'orders',     labelKey: 'orderHistory',    icon: ClipboardList },
];

const TAB_COMPONENTS: Record<Tab, React.FC> = {
    dashboard:  DashboardView,
    analytics:  AnalyticsView,
    products:   ProductsView,
    categories: CategoriesView,
    inventory:  InventoryView,
    tables:     TablesView,
    users:      UsersView,
    orders:     OrdersView,
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
    const { user } = useAuth();
    const searchParams = useSearchParams();
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);

    // Load restaurant info to determine which tabs to show
    useEffect(() => {
        getRestaurant(user?.restaurant_id || undefined)
            .then(setRestaurant)
            .catch(console.error);

        function onBusinessUpdated() {
            getRestaurant(user?.restaurant_id || undefined)
                .then(setRestaurant)
                .catch(console.error);
        }
        window.addEventListener('business-updated', onBusinessUpdated);
        return () => window.removeEventListener('business-updated', onBusinessUpdated);
    }, [user]);

    // Handle ?tab= query param
    useEffect(() => {
        const tab = searchParams.get('tab') as Tab | null;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (tab && tab in TAB_COMPONENTS) setActiveTab(tab);
    }, [searchParams]);

    // If tables tab is active but business doesn't need tables, fall back to analytics
    const showTables = needsTables(restaurant);
    useEffect(() => {
        if (!showTables && activeTab === 'tables') {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setActiveTab('analytics');
        }
    }, [showTables, activeTab]);

    // Filter tabs based on business type
    const visibleTabs = ALL_TABS.filter(tab => tab.id !== 'tables' || showTables);

    const ActiveComponent = TAB_COMPONENTS[activeTab];

    return (
        <>
            {/* Horizontal tab bar */}
            <header className="flex-shrink-0 bg-[var(--bg-card)] border-b border-[var(--border)] overflow-x-auto no-scrollbar">
                <nav className="px-3 flex items-center h-11 gap-0.5 min-w-max">
                    {visibleTabs.map(({ id, labelKey, icon: Icon }) => {
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
