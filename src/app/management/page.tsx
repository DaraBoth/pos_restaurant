'use client';
import Link from 'next/link';
import { useLanguage } from '@/providers/LanguageProvider';
import { Package, Users, RefreshCw, ClipboardList, Building2, ArrowRight, TrendingUp } from 'lucide-react';

const QUICK_LINKS = [
    { href: '/management/analytics', labelEn: 'Analytics',    labelKm: 'ážšáž”áž¶áž™áž€áž¶ážšážŽáŸ',       descEn: 'Revenue, orders, and earnings reports.', descKm: 'áž…áŸ†ážŽáž¼áž›, áž”áž‰áŸ’áž‡áž¶áž‘áž·áž‰, áž“áž·áž„ážšáž”áž¶áž™áž€áž¶ážšážŽáŸ', icon: TrendingUp, color: '#22c55e' },
    { href: '/management/products',  labelEn: 'Products',     labelKm: 'áž•áž›áž·ážáž•áž›',          descEn: 'Menu items, pricing, and stock.', descKm: 'áž˜áž»ážáž˜áŸ’áž áž¼áž”, ážáž˜áŸ’áž›áŸƒ, áž“áž·áž„ážŸáŸ’ážáž»áž€', icon: Package, color: '#0ea5e9' },
    { href: '/management/users',     labelEn: 'Staff',        labelKm: 'áž–áž“áž€áŸ’áž',            descEn: 'Staff accounts and permissions.', descKm: 'áž‚ážŽáž“áž¸áž”áž»áž‚áŸ’áž‚áž›áž·áž€', icon: Users, color: '#a78bfa' },
    { href: '/management/exchange-rate', labelEn: 'Exchange Rate', labelKm: 'áž¢ážáŸ’ážšáž¶',      descEn: 'USD â†” KHR conversion rate.', descKm: 'áž¢ážáŸ’ážšáž¶áž”áŸ’ážáž¼ážšážšáž¼áž”áž·áž™áž”áŸážŽáŸ’ážŽ', icon: RefreshCw, color: '#fbbf24' },
    { href: '/management/orders',    labelEn: 'Order History', labelKm: 'áž”áŸ’ážšážœážáŸ’ážáž·áž€áž¶ážšáž›áž€áŸ‹', descEn: 'Past receipts and exported reports.', descKm: 'ážœáž·áž€áŸ’áž€áž™áž”ážáŸ’ážš, áž“áž·áž„ážšáž”áž¶áž™áž€áž¶ážšážŽáŸ', icon: ClipboardList, color: '#f97316' },
    { href: '/management/settings',  labelEn: 'Settings',     labelKm: 'áž€áž¶ážšáž€áŸ†ážŽážáŸ‹',        descEn: 'Restaurant info, receipt, taxes.', descKm: 'áž–áŸážáŸŒáž˜áž¶áž“áž—áŸ„áž‡áž“áž¸áž™ážŠáŸ’áž‹áž¶áž“', icon: Building2, color: '#f43f5e' },
];

export default function ManagementDashboard() {
    const { lang } = useLanguage();

    return (
        <div className="animate-fade-in">
            <div className="mb-4">
                <h1 className="text-base font-black text-[var(--foreground)] mb-0.5">
                    {lang === 'km' ? 'áž•áŸ’áž‘áž¶áŸ†áž„áž‚áŸ’ážšáž”áŸ‹áž‚áŸ’ážšáž„' : 'Management'}
                </h1>
                <p className="text-xs text-[var(--text-secondary)]">
                    {lang === 'km' ? 'áž€áž¶ážšáž‚áŸ’ážšáž”áŸ‹áž‚áŸ’ážšáž„áž”áŸ’ážšážáž·áž”ážáŸ’ážáž·áž€áž¶ážšáž—áŸ„áž‡áž“áž¸áž™ážŠáŸ’áž‹áž¶áž“' : 'Manage your restaurant operations'}
                </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {QUICK_LINKS.map(({ href, labelEn, labelKm, descEn, descKm, icon: Icon, color }) => (
                    <Link
                        key={href}
                        href={href}
                        className="group flex flex-col p-3.5 rounded-xl transition-all bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent-blue)]/35 hover:shadow-lg hover:-translate-y-0.5 active:scale-95"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center"
                                style={{ background: `${color}18`, border: `1px solid ${color}30` }}
                            >
                                <Icon size={18} style={{ color }} strokeWidth={2} />
                            </div>
                            <ArrowRight size={14} className="text-[var(--text-secondary)] group-hover:text-[var(--accent-blue)] transition-colors mt-1" />
                        </div>
                        <h2 className={`text-sm font-bold text-[var(--foreground)] mb-1 ${lang === 'km' ? 'khmer' : ''}`}>
                            {lang === 'km' ? labelKm : labelEn}
                        </h2>
                        <p className={`text-xs text-[var(--text-secondary)] leading-snug line-clamp-2 ${lang === 'km' ? 'khmer' : ''}`}>
                            {lang === 'km' ? descKm : descEn}
                        </p>
                    </Link>
                ))}
            </div>
        </div>
    );
}
