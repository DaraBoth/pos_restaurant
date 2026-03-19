'use client';
import Link from 'next/link';
import { Package, Users, RefreshCw, ClipboardList, Building2, ArrowRight } from 'lucide-react';

const QUICK_LINKS = [
    { 
        href: '/management/products', 
        label: 'Products', 
        desc: 'Manage menu items, prices, and stock levels.', 
        icon: Package, 
        color: '#f97316' // Orange
    },
    { 
        href: '/management/categories', 
        label: 'Categories', 
        desc: 'Organize products into logical groups.', 
        icon: Building2, 
        color: '#fb923c' // Light Orange
    },
    { 
        href: '/management/users', 
        label: 'Staff', 
        desc: 'Manage staff accounts, credentials, and access levels.', 
        icon: Users, 
        color: '#fbbf24' // Amber
    },
    { 
        href: '/management/exchange-rate', 
        label: 'Exchange', 
        desc: 'Update the live USD ↔ KHR calculation rate.', 
        icon: RefreshCw, 
        color: '#84cc16' // Lime
    },
    { 
        href: '/management/orders', 
        label: 'Orders', 
        desc: 'Audit past receipts, refunds, and revenue totals.', 
        icon: ClipboardList, 
        color: '#0ea5e9' // Ocean Blue
    },
    { 
        href: '/management/settings', 
        label: 'Settings', 
        desc: 'Configure restaurant name, receipt headers, and taxes.', 
        icon: Building2, 
        color: '#f43f5e' // Coral/Rose
    },
];

export default function ManagementDashboard() {
    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="mb-[var(--space-unit)]">
                <h1 className="text-[var(--text-4xl)] font-black tracking-tight mb-2 text-[var(--foreground)]">Back Office</h1>
                <p className="text-[var(--text-secondary)] font-bold uppercase tracking-[0.2em] text-[var(--text-xs)] opacity-60">
                    Restaurant Operations & Control Center
                </p>
            </div>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-[var(--space-unit)]">
                {QUICK_LINKS.map(({ href, label, desc, icon: Icon, color }) => (
                    <Link
                        key={href}
                        href={href}
                        className="group flex flex-col p-[var(--space-unit)] rounded-[1.1rem] transition-all relative overflow-hidden bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent-blue)]/35 hover:shadow-2xl hover:shadow-[var(--accent-blue)]/10 hover:-translate-y-1"
                    >
                        {/* Top Context */}
                        <div className="flex items-start justify-between mb-10 relative z-10">
                            <div
                                className="w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm"
                                style={{ 
                                    background: `color-mix(in srgb, ${color} 10%, #fff)`, 
                                    border: `1px solid color-mix(in srgb, ${color} 20%, transparent)` 
                                }}
                            >
                                <Icon size={24} style={{ color }} strokeWidth={2.5} />
                            </div>
                            
                            <div 
                                className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--bg-elevated)] border border-[var(--border)] transition-colors group-hover:bg-[var(--accent-blue)] group-hover:text-white"
                            >
                                <ArrowRight size={18} className="text-[var(--text-secondary)] group-hover:text-white transition-colors" />
                            </div>
                        </div>

                        {/* Text Content */}
                        <div className="mt-auto relative z-10">
                            <h2 className="text-[var(--text-xl)] font-black text-[var(--foreground)] mb-2">
                                {label}
                            </h2>
                            <p className="text-[var(--text-sm)] font-medium text-[var(--text-secondary)] leading-relaxed">
                                {desc}
                            </p>
                        </div>
                    </Link>
                ))}
            </div>
            
            {/* System Status Pill */}
            <div className="mt-12 inline-flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border)] shadow-sm">
                <div className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Services Online</span>
            </div>
        </div>
    );
}
