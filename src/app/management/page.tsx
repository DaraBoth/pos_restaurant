'use client';
import Link from 'next/link';
import { useLanguage } from '@/providers/LanguageProvider';
import { Package, Users, RefreshCw, ClipboardList, Building2, ArrowRight, TrendingUp } from 'lucide-react';

const QUICK_LINKS = [
    { href: '/management/analytics', labelEn: 'Analytics',    labelKm: 'របាយការណ៍',       descEn: 'Revenue, orders, and earnings reports.', descKm: 'ចំណូល, បញ្ជាទិញ, និងរបាយការណ៍', icon: TrendingUp, color: '#22c55e' },
    { href: '/management/products',  labelEn: 'Products',     labelKm: 'ផលិតផល',          descEn: 'Menu items, pricing, and stock.', descKm: 'មុខម្ហូប, តម្លៃ, និងស្តុក', icon: Package, color: '#0ea5e9' },
    { href: '/management/users',     labelEn: 'Staff',        labelKm: 'ពនក្ខ',            descEn: 'Staff accounts and permissions.', descKm: 'គណនីបុគ្គលិក', icon: Users, color: '#a78bfa' },
    { href: '/management/exchange-rate', labelEn: 'Exchange Rate', labelKm: 'អត្រា',      descEn: 'USD â†” KHR conversion rate.', descKm: 'អត្រាប្តូររូបិយប័ណ្ណ', icon: RefreshCw, color: '#fbbf24' },
    { href: '/management/orders',    labelEn: 'Order History', labelKm: 'ប្រវត្តិការលក់', descEn: 'Past receipts and exported reports.', descKm: 'វិក្កយបត្រ, និងរបាយការណ៍', icon: ClipboardList, color: '#f97316' },
    { href: '/management/settings',  labelEn: 'Settings',     labelKm: 'ការកំណត់',        descEn: 'Restaurant info, receipt, taxes.', descKm: 'ព័ត៌មានភោជនីយដ្ឋាន', icon: Building2, color: '#f43f5e' },
];

export default function ManagementDashboard() {
    const { lang } = useLanguage();

    return (
        <div className="animate-fade-in">
            <div className="mb-4">
                <h1 className="text-base font-black text-[var(--foreground)] mb-0.5">
                    {lang === 'km' ? 'ផ្ទាំងគ្រប់គ្រង' : 'Management'}
                </h1>
                <p className="text-xs text-[var(--text-secondary)]">
                    {lang === 'km' ? 'ការគ្រប់គ្រងប្រតិបត្តិការភោជនីយដ្ឋាន' : 'Manage your restaurant operations'}
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
