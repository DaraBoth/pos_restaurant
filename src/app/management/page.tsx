'use client';
import Link from 'next/link';
import { Package, Users, RefreshCw, ClipboardList, Building2, ArrowRight } from 'lucide-react';

const QUICK_LINKS = [
    { 
        href: '/management/products', 
        label: 'Products', 
        desc: 'Manage menu items, categories, and inventory stock.', 
        icon: Package, 
        color: '#3b82f6' // Trust Blue
    },
    { 
        href: '/management/users', 
        label: 'Staff', 
        desc: 'Manage staff accounts, credentials, and access levels.', 
        icon: Users, 
        color: '#3b82f6' 
    },
    { 
        href: '/management/exchange-rate', 
        label: 'Exchange', 
        desc: 'Update the live USD ↔ KHR calculation rate.', 
        icon: RefreshCw, 
        color: '#3b82f6' 
    },
    { 
        href: '/management/orders', 
        label: 'Orders', 
        desc: 'Audit past receipts, refunds, and revenue totals.', 
        icon: ClipboardList, 
        color: '#3b82f6' 
    },
    { 
        href: '/management/settings', 
        label: 'Settings', 
        desc: 'Configure restaurant name, receipt headers, and taxes.', 
        icon: Building2, 
        color: '#3b82f6' 
    },
];

export default function ManagementDashboard() {
    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="mb-10">
                <h1 className="text-3xl font-bold tracking-tight mb-2 text-white">System Dashboard</h1>
                <p className="text-[var(--text-secondary)] font-medium">
                    Core management tools. All changes save instantly to the local datastore.
                </p>
            </div>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {QUICK_LINKS.map(({ href, label, desc, icon: Icon, color }) => (
                    <Link
                        key={href}
                        href={href}
                        className="group flex flex-col p-6 rounded-2xl transition-all relative overflow-hidden bg-[#181a20] border border-white/5 hover:border-white/10 hover:shadow-lg"
                    >
                        {/* Top Context */}
                        <div className="flex items-start justify-between mb-8 relative z-10">
                            <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                                style={{ 
                                    background: `color-mix(in srgb, ${color} 15%, transparent)`, 
                                    border: `1px solid color-mix(in srgb, ${color} 30%, transparent)` 
                                }}
                            >
                                <Icon size={22} style={{ color }} strokeWidth={2} />
                            </div>
                            
                            <div 
                                className="w-8 h-8 rounded-full flex items-center justify-center bg-[#0f1115] border border-white/5 transition-colors group-hover:bg-white/5"
                            >
                                <ArrowRight size={16} className="text-[var(--text-secondary)] group-hover:text-white transition-colors" />
                            </div>
                        </div>

                        {/* Text Content */}
                        <div className="mt-auto relative z-10">
                            <h2 className="text-lg font-bold text-white mb-1">
                                {label}
                            </h2>
                            <p className="text-sm font-medium text-[var(--text-secondary)] leading-relaxed">
                                {desc}
                            </p>
                        </div>
                    </Link>
                ))}
            </div>
            
            {/* System Status Pill */}
            <div className="mt-10 inline-flex items-center gap-2.5 px-4 py-2 rounded-lg bg-[#181a20] border border-white/5">
                <div className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </div>
                <span className="text-xs font-semibold text-[var(--text-secondary)]">Datastore Online</span>
            </div>
        </div>
    );
}
