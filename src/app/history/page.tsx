'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { getOrders, getOrderItems, deleteOrderHistory } from '@/lib/api/orders';
import { getRestaurant } from '@/lib/api/restaurant';
import { closeDailyReport, getDailyReportDetail, getDailyReportPreview, getDailyReports } from '@/lib/api/reports';
import { DailyReport, DailyReportDetail, DailyReportExpenseInput, DailyReportPreview, Order, OrderItem, Restaurant } from '@/types';
import { useAuth } from '@/providers/AuthProvider';
import { formatUsd, formatKhr } from '@/lib/currency';
import { printReceipt } from '@/lib/receipt';
import {
    History, RefreshCw, TableProperties, ChevronDown,
    ChevronUp, Download, Clock, ReceiptText,
    LayoutList, LayoutGrid, Printer, Trash2
} from 'lucide-react';
// Dynamic import for XLSX to avoid bundling issues
let XLSX_MODULE: any = null;
import { useLanguage } from '@/providers/LanguageProvider';
import { call } from '@/lib/api/client';
import { format } from 'date-fns';
import { printDailyClosingReport, printSalesSummary } from '@/lib/reports';
import { getTopProductsInRange } from '@/lib/api/analytics';
import { getImageSrc } from '@/lib/image';
import { canDelete } from '@/lib/permissions';
import { CustomSelect } from '@/components/ui/CustomSelect';

type StatusFilter = 'all' | 'open' | 'completed' | 'hold';
type PageTab = 'orders' | 'reports' | 'report-history';
type ReportFilter = 'all' | 'closed';
const ORDER_HISTORY_VIEW_MODE_KEY = 'dineos.history.viewMode';

interface CashAdjustmentRow {
    id: string;
    date: string;
    category: string;
    description: string;
    price: string;
}

const EXPENSE_CATEGORIES = [
    'Inventory',
    'Utility',
    'Transportation',
    'Maintenance',
    'Salary',
    'Equipment',
    'Other',
];

export interface GroupedOrder {
    id: string; // session_id or order_id
    table_id: string | null;
    status: StatusFilter | 'pending_payment';
    created_at: string;
    total_usd: number;
    total_khr: number;
    total_vat: number;
    total_plt: number;
    orders: Order[];
}

function combineOrderItems(items: OrderItem[]): OrderItem[] {
    const map = new Map<string, OrderItem>();
    for (const item of items) {
        if (map.has(item.product_id)) {
            map.get(item.product_id)!.quantity += item.quantity;
        } else {
            map.set(item.product_id, { ...item });
        }
    }
    return Array.from(map.values());
}

const STATUS_TABS: { id: StatusFilter; labelKey: any }[] = [
    { id: 'all', labelKey: 'allFilter' },
    { id: 'open', labelKey: 'open' },
    { id: 'completed', labelKey: 'completed' },
    { id: 'hold', labelKey: 'hold' },
];

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
    completed: { bg: 'rgba(34,197,94,0.1)', text: '#22c55e', border: 'rgba(34,197,94,0.25)' },
    open: { bg: 'rgba(249,115,22,0.1)', text: '#f97316', border: 'rgba(249,115,22,0.25)' },
    hold: { bg: 'rgba(234,179,8,0.12)', text: '#eab308', border: 'rgba(234,179,8,0.3)' },
    pending_payment: { bg: 'rgba(234,179,8,0.12)', text: '#eab308', border: 'rgba(234,179,8,0.3)' },
};

export default function HistoryPage() {
    const searchParams = useSearchParams();
    const { t, lang } = useLanguage();
    const { user } = useAuth();
    const restaurantId = user?.restaurant_id;
    const [activeTab, setActiveTab] = useState<PageTab>('orders');
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<StatusFilter>('all');
    const [reportFilter, setReportFilter] = useState<ReportFilter>('all');
    const [reportSearch, setReportSearch] = useState('');
    const [expandedRows, setExpandedRows] = useState<string[]>([]);
    const [orderDetails, setOrderDetails] = useState<Record<string, OrderItem[]>>({});
    const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => {
        if (typeof window === 'undefined') return 'grid';
        const saved = window.localStorage.getItem(ORDER_HISTORY_VIEW_MODE_KEY);
        return saved === 'table' || saved === 'grid' ? saved : 'grid';
    });
    const loadingItemsRef = useRef<Set<string>>(new Set());

    const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
    const [dailyPreview, setDailyPreview] = useState<DailyReportPreview | null>(null);
    const [reportNotes, setReportNotes] = useState('');
    const [closedReports, setClosedReports] = useState<DailyReport[]>([]);
    const [closingReport, setClosingReport] = useState(false);
    const [adjustments, setAdjustments] = useState<CashAdjustmentRow[]>([
        { id: 'adj-1', date: format(new Date(), 'yyyy-MM-dd'), category: 'Inventory', description: '', price: '' },
    ]);

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'reports') {
            setActiveTab('reports');
        } else if (tab === 'report-history') {
            setActiveTab('report-history');
        }
    }, [searchParams]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(ORDER_HISTORY_VIEW_MODE_KEY, viewMode);
    }, [viewMode]);

    function createAdjustmentRow(): CashAdjustmentRow {
        return {
            id: `adj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            date: format(new Date(), 'yyyy-MM-dd'),
            category: 'Inventory',
            description: '',
            price: '',
        };
    }

    function updateAdjustmentRow(id: string, field: keyof Omit<CashAdjustmentRow, 'id'>, value: string) {
        setAdjustments(prev => prev.map(row => (row.id === id ? { ...row, [field]: value } : row)));
    }

    function addAdjustmentRow() {
        setAdjustments(prev => [...prev, createAdjustmentRow()]);
    }

    function removeAdjustmentRow(id: string) {
        setAdjustments(prev => {
            const next = prev.filter(row => row.id !== id);
            return next.length > 0 ? next : [createAdjustmentRow()];
        });
    }

    const normalizedAdjustments = useMemo(() => {
        return adjustments
            .map(row => {
                const priceValue = Number(String(row.price).replace(/,/g, '').trim());
                return {
                    date: row.date.trim(),
                    category: row.category.trim() || 'Other',
                    description: row.description.trim(),
                    price_cents: Number.isFinite(priceValue) ? Math.max(0, Math.round(priceValue * 100)) : 0,
                };
            })
            .filter(row => row.description && row.price_cents > 0);
    }, [adjustments]);

    const adjustmentTotalCents = normalizedAdjustments.reduce((sum, row) => sum + row.price_cents, 0);

    useEffect(() => {
        loadOrders();
        loadRestaurant();
        loadDailyReportPreview();
        loadClosedReports();
    }, [startDate, endDate]);

    useEffect(() => {
        loadClosedReports();
    }, [reportFilter]);

    async function loadRestaurant() {
        try {
            const data = await getRestaurant(restaurantId || undefined);
            setRestaurant(data);
        } catch (e) {
            console.error(e);
        }
    }

    async function loadOrders() {
        setLoading(true);
        try {
            const data = await getOrders(undefined, startDate, endDate, restaurantId || '');
            setOrders(
                data
                    .filter((order) => order.status === 'completed')
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            );
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function loadDailyReportPreview() {
        if (!restaurantId) {
            setDailyPreview(null);
            return;
        }
        try {
            const preview = await getDailyReportPreview(endDate, restaurantId);
            setDailyPreview(preview);
            if (preview.is_closed && preview.existing_report_id) {
                const detail = await getDailyReportDetail(preview.existing_report_id, restaurantId);
                setReportNotes(detail.report.notes || '');
                setAdjustments(
                    detail.expenses.length > 0
                        ? detail.expenses.map((e) => ({
                            id: e.id,
                            date: e.date,
                            category: e.category,
                            description: e.description,
                            price: (e.amount_usd_cents / 100).toFixed(2),
                        }))
                        : [createAdjustmentRow()]
                );
            } else {
                setReportNotes('');
                setAdjustments([createAdjustmentRow()]);
            }
        } catch (e) {
            console.error('Failed loading daily report preview', e);
            setDailyPreview(null);
        }
    }

    async function loadClosedReports() {
        if (!restaurantId) {
            setClosedReports([]);
            return;
        }
        try {
            const rows = await getDailyReports(restaurantId, startDate, endDate, reportFilter === 'all' ? undefined : reportFilter);
            setClosedReports(rows);
        } catch (e) {
            console.error('Failed loading closed reports', e);
            setClosedReports([]);
        }
    }

    async function handleDeleteGroup(group: GroupedOrder) {
        if (!user || !user.id) return;
        if (!canDelete(user.role)) {
            window.alert('Permission denied: delete is only available to Admin roles.');
            return;
        }
        const confirmMsg = t('confirmDeleteHistory') || 'Are you sure you want to permanently delete this order history? This will remove it from both local and cloud databases and sync across all devices.';
        if (!window.confirm(confirmMsg)) return;

        try {
            // A table order session has session_id, whereas takeout has just order_id
            const hasSession = group.orders.some(o => !!o.session_id);
            const sessionId = hasSession ? group.id : null;
            const orderId = !hasSession ? group.id : null;

            await deleteOrderHistory(sessionId, orderId, restaurantId || '', user.id);
            loadOrders();
        } catch (e: any) {
            console.error('Failed to delete history', e);
            window.alert((t('error') || 'Error') + ': ' + (e.message || e));
        }
    }

    const allGroupedOrders = useMemo(() => {
        const map = new Map<string, GroupedOrder>();
        for (const o of orders) {
            const key = o.session_id || o.id;
            if (!map.has(key)) {
                map.set(key, {
                    id: key,
                    table_id: o.table_id || null,
                    status: o.status as any,
                    created_at: o.created_at,
                    total_usd: 0,
                    total_khr: 0,
                    total_vat: 0,
                    total_plt: 0,
                    orders: []
                });
            }
            const g = map.get(key)!;
            g.total_usd += o.total_usd;
            g.total_khr += o.total_khr;
            g.total_vat += (o.tax_vat || 0);
            g.total_plt += (o.tax_plt || 0);
            g.orders.push(o);
            // take earliest date
            if (new Date(o.created_at) < new Date(g.created_at)) {
                g.created_at = o.created_at;
            }
            // Upgrade group status priority: open > hold > completed
            if (o.status === 'open') g.status = 'open' as any;
            else if (['hold', 'pending_payment'].includes(o.status) && g.status !== 'open') g.status = 'hold' as any;
        }
        return Array.from(map.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [orders]);

    const groupedOrders = useMemo(() => {
        if (filter === 'all') return allGroupedOrders;
        return allGroupedOrders.filter(g => g.status === filter);
    }, [allGroupedOrders, filter]);

    const filteredReports = useMemo(() => {
        const keyword = reportSearch.trim().toLowerCase();
        if (!keyword) return closedReports;
        return closedReports.filter(report => (
            report.report_date.toLowerCase().includes(keyword)
            || (report.cashier_name || '').toLowerCase().includes(keyword)
            || (report.status || '').toLowerCase().includes(keyword)
        ));
    }, [closedReports, reportSearch]);

    const filtered = groupedOrders;

    useEffect(() => {
        if (viewMode !== 'grid' || filtered.length === 0) return;

        const toLoad: Order[] = [];
        filtered.forEach(g => {
            g.orders.forEach(o => {
                if (!orderDetails[o.id] && !loadingItemsRef.current.has(o.id)) {
                    toLoad.push(o);
                }
            });
        });

        if (toLoad.length === 0) return;

        toLoad.forEach(o => loadingItemsRef.current.add(o.id));
        Promise.all(
            toLoad.map(o =>
                getOrderItems(o.id, restaurantId || '')
                    .then(items => ({ id: o.id, items }))
                    .catch(() => ({ id: o.id, items: [] as OrderItem[] }))
            )
        ).then(results => {
            setOrderDetails(prev => {
                const next = { ...prev };
                results.forEach(r => { next[r.id] = r.items; });
                return next;
            });
            results.forEach(r => loadingItemsRef.current.delete(r.id));
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewMode, filter, orders]);

    async function toggleRow(groupId: string) {
        setExpandedRows(prev => {
            if (prev.includes(groupId)) return prev.filter(id => id !== groupId);
            return [...prev, groupId];
        });

        const group = groupedOrders.find(g => g.id === groupId);
        if (!group) return;

        group.orders.forEach(async (order) => {
            if (!orderDetails[order.id]) {
                try {
                    const items = await getOrderItems(order.id, restaurantId || '');
                    setOrderDetails(prev => ({ ...prev, [order.id]: items }));
                } catch (e) {
                    console.error('Failed to load items', e);
                }
            }
        });
    }

    const handleExport = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        try {
            if (!filtered || filtered.length === 0) {
                window.alert(t('noMatchingTransactions'));
                return;
            }

            // Load XLSX
            if (!XLSX_MODULE) {
                XLSX_MODULE = await import('xlsx');
            }
            const X = XLSX_MODULE.utils ? XLSX_MODULE : XLSX_MODULE.default;
            if (!X || !X.utils) throw new Error('XLSX utils not found');

            // Map data
            const exportData = filtered.map(g => {
                const isoDate = g.created_at.replace(' ', 'T') + 'Z';
                return {
                    'ID': g.id.split('-')[0].toUpperCase(),
                    'Date': new Date(isoDate).toLocaleDateString(),
                    'Table': g.table_id || 'Takeout',
                    'Status': g.status.toUpperCase(),
                    'USD': (g.total_usd / 100).toFixed(2),
                    'KHR': g.total_khr.toLocaleString(),
                };
            });

            // Generate WB
            const ws = X.utils.json_to_sheet(exportData);
            const wb = X.utils.book_new();
            X.utils.book_append_sheet(wb, ws, 'Orders');

            // Generate Array Buffer
            const excelBuffer = X.write(wb, { bookType: 'xlsx', type: 'array' });

            // Convert to regular array for IPC transfer
            const content = Array.from(new Uint8Array(excelBuffer));
            const filename = `Report_${startDate}_to_${endDate}.xlsx`;

            // Invoke native Rust bridge to save file
            const savedPath = await call<string>('save_excel_file', { content, filename });

            if (savedPath === 'CANCELLED') {
                console.log('Export cancelled by user.');
                return;
            }

            window.alert('Success! Report saved to:\n' + savedPath);
            console.log('Report saved to:', savedPath);
        } catch (error: any) {
            console.error('Export critical failure:', error);
            window.alert('Export Failed: ' + error.message);
        }
    };

    const handlePrintSummary = async () => {
        if (!restaurant || !allGroupedOrders || allGroupedOrders.length === 0) return;

        // Best-sellers query is scoped to the same date range, fetched fresh —
        // never reuse the page's lazy-loaded order items, which may be a partial set.
        let topItems = undefined;
        if (restaurantId) {
            try {
                topItems = await getTopProductsInRange(startDate, endDate, restaurantId, 5);
            } catch (e) {
                console.error('Failed to load top items for summary', e);
            }
        }

        printSalesSummary({
            restaurant,
            startDate,
            endDate,
            groups: allGroupedOrders.map(g => ({
                id: g.id,
                table_id: g.table_id,
                status: g.status,
                created_at: g.created_at,
                total_usd: g.total_usd,
                total_khr: g.total_khr,
                total_vat: g.total_vat,
                total_plt: g.total_plt,
            })),
            cashierName: user?.full_name || user?.username,
            topItems,
            adjustments: normalizedAdjustments.map(row => ({
                date: row.date,
                info: `${row.category}: ${row.description}`,
                price_cents: row.price_cents,
            })),
        });
    };

    const handlePrintDailyReport = async (report: DailyReport) => {
        if (!restaurant || !restaurantId) return;
        try {
            const detail = await getDailyReportDetail(report.id, restaurantId);
            printDailyClosingReport(restaurant, detail);
        } catch (e: any) {
            window.alert('Failed to load report detail: ' + (e?.message || e));
        }
    };

    const handleExportDailyReport = async (report: DailyReport) => {
        if (!restaurantId) return;

        try {
            if (!XLSX_MODULE) {
                XLSX_MODULE = await import('xlsx');
            }
            const X = XLSX_MODULE.utils ? XLSX_MODULE : XLSX_MODULE.default;
            if (!X || !X.utils) throw new Error('XLSX utils not found');

            const detail = await getDailyReportDetail(report.id, restaurantId);
            const dayOrders = await getOrders(undefined, report.report_date, report.report_date, restaurantId);

            const summaryRows = [
                { Field: 'Report Date', Value: report.report_date },
                { Field: 'Cashier', Value: report.cashier_name || '' },
                { Field: 'Total Orders', Value: report.total_orders },
                { Field: 'Paid Orders', Value: report.paid_orders },
                { Field: 'Voided Orders', Value: report.voided_orders },
                { Field: 'Total Sales', Value: (report.total_sales_usd / 100).toFixed(2) },
                { Field: 'Total Expenses', Value: (report.total_expenses_usd / 100).toFixed(2) },
                { Field: 'Operational Profit', Value: (report.net_profit_usd / 100).toFixed(2) },
                { Field: 'Inventory Usage Cost', Value: (detail.inventory_total_cost_usd / 100).toFixed(2) },
                { Field: 'Estimated Profit After Inventory', Value: ((report.net_profit_usd - detail.inventory_total_cost_usd) / 100).toFixed(2) },
            ];

            const salesRows = dayOrders
                .filter(o => o.status === 'completed')
                .map(o => ({
                    'Invoice No': o.id.split('-')[0].toUpperCase(),
                    Time: new Date(o.created_at + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    Table: o.table_id || 'Takeout',
                    Total: (o.total_usd / 100).toFixed(2),
                }));

            const expenseRows = detail.expenses.map(e => ({
                Date: e.date,
                Category: e.category,
                Description: e.description,
                Amount: (e.amount_usd_cents / 100).toFixed(2),
            }));

            const inventoryRows = detail.inventory_usage.map(i => ({
                'Inventory Item': i.inventory_item_name,
                'Used Qty': i.used_quantity.toFixed(2),
                Unit: i.unit_label,
                'Cost / Unit': i.cost_per_unit.toFixed(2),
                'Total Cost': (i.total_cost_usd / 100).toFixed(2),
            }));

            const wb = X.utils.book_new();
            X.utils.book_append_sheet(wb, X.utils.json_to_sheet(summaryRows), 'Summary');
            X.utils.book_append_sheet(wb, X.utils.json_to_sheet(salesRows), 'Sales Details');
            X.utils.book_append_sheet(wb, X.utils.json_to_sheet(expenseRows), 'Expense Details');
            X.utils.book_append_sheet(wb, X.utils.json_to_sheet(inventoryRows), 'Inventory Usage');

            const excelBuffer = X.write(wb, { bookType: 'xlsx', type: 'array' });
            const content = Array.from(new Uint8Array(excelBuffer));
            const filename = `Daily_Report_${report.report_date}.xlsx`;
            const savedPath = await call<string>('save_excel_file', { content, filename });

            if (savedPath === 'CANCELLED') return;
            window.alert('Success! Report saved to:\n' + savedPath);
        } catch (e: any) {
            window.alert('Export failed: ' + (e?.message || e));
        }
    };

    const handleCloseReport = async () => {
        if (!restaurantId || !user?.id) return;
        if (dailyPreview?.is_closed) {
            window.alert('Today\'s report is already closed.');
            return;
        }

        const confirmed = window.confirm(
            'Are you sure you want to close today\'s report?\n\nAfter closing:\n- Report becomes read-only\n- Historical record is created\n- Report can be printed and exported'
        );
        if (!confirmed) return;

        const expenses: DailyReportExpenseInput[] = normalizedAdjustments.map(row => ({
            date: row.date,
            category: row.category,
            description: row.description,
            amount_usd_cents: row.price_cents,
        }));

        try {
            setClosingReport(true);
            const currentRestaurant = restaurant;
            if (!currentRestaurant) {
                throw new Error('Restaurant not loaded');
            }
            const detail: DailyReportDetail = await closeDailyReport(
                endDate,
                restaurantId,
                user.id,
                user.full_name || user.username,
                reportNotes || undefined,
                expenses,
            );
            if (restaurantId) {
                window.localStorage.removeItem(`dineos.daily-close-draft.${restaurantId}.${endDate}`);
            }
            await loadDailyReportPreview();
            await loadClosedReports();
            printDailyClosingReport(currentRestaurant, detail);
        } catch (e: any) {
            window.alert('Close report failed: ' + (e?.message || e));
        } finally {
            setClosingReport(false);
        }
    };

    // Stats
    const completed = allGroupedOrders.filter(g => g.status === 'completed');

    // Total revenue is just the sum of completed groups
    const totalRevenueCents = completed.reduce((s, g) => s + g.total_usd, 0);
    const totalSalesCents = dailyPreview?.total_sales_usd ?? 0;
    const netProfitCents = Math.max(totalSalesCents - adjustmentTotalCents, 0);
    const inventoryUsageRows = dailyPreview?.inventory_usage ?? [];
    const inventoryUsageCostCents = dailyPreview?.inventory_total_cost_usd ?? 0;
    const estimatedProfitAfterInventoryCents = netProfitCents - inventoryUsageCostCents;

    const handleSaveDraft = () => {
        if (!restaurantId) return;
        const draftKey = `dineos.daily-close-draft.${restaurantId}.${endDate}`;
        window.localStorage.setItem(draftKey, JSON.stringify({
            notes: reportNotes,
            expenses: adjustments,
        }));
        window.alert('Draft saved.');
    };

    const handlePrintPreview = () => {
        if (!restaurant || !restaurantId) return;

        const nowIso = new Date().toISOString();
        const reportDate = dailyPreview?.report_date || endDate;

        const previewDetail: DailyReportDetail = {
            report: {
                id: 'preview',
                restaurant_id: restaurantId,
                report_date: reportDate,
                total_orders: dailyPreview?.total_orders ?? 0,
                paid_orders: dailyPreview?.paid_orders ?? 0,
                voided_orders: dailyPreview?.voided_orders ?? 0,
                total_sales_usd: totalSalesCents,
                total_sales_khr: dailyPreview?.total_sales_khr ?? 0,
                total_expenses_usd: adjustmentTotalCents,
                net_profit_usd: netProfitCents,
                notes: reportNotes,
                status: dailyPreview?.is_closed ? 'closed' : 'preview',
                cashier_name: user?.full_name || user?.username,
                closed_by_user_id: user?.id,
                closed_at: nowIso,
                created_at: nowIso,
                updated_at: nowIso,
            },
            expenses: normalizedAdjustments.map((row, index) => ({
                id: `preview-expense-${index + 1}`,
                report_id: 'preview',
                date: row.date,
                category: row.category,
                description: row.description,
                amount_usd_cents: row.price_cents,
            })),
            inventory_total_usage_qty: dailyPreview?.inventory_total_usage_qty ?? 0,
            inventory_total_cost_usd: inventoryUsageCostCents,
            inventory_usage: inventoryUsageRows,
        };

        printDailyClosingReport(restaurant, previewDetail);
    };

    useEffect(() => {
        if (!restaurantId || dailyPreview?.is_closed) return;

        const draftKey = `dineos.daily-close-draft.${restaurantId}.${endDate}`;
        const raw = window.localStorage.getItem(draftKey);
        if (!raw) return;

        try {
            const parsed = JSON.parse(raw) as { notes?: string; expenses?: CashAdjustmentRow[] };
            if (typeof parsed.notes === 'string') {
                setReportNotes(parsed.notes);
            }
            if (Array.isArray(parsed.expenses) && parsed.expenses.length > 0) {
                setAdjustments(parsed.expenses.map((row) => ({
                    id: row.id || `adj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    date: row.date || format(new Date(), 'yyyy-MM-dd'),
                    category: row.category || 'Other',
                    description: row.description || '',
                    price: row.price || '',
                })));
            }
        } catch {
            // Ignore invalid draft data.
        }
    }, [restaurantId, endDate, dailyPreview?.is_closed]);

    return (
        <div className="max-w-7xl mx-auto px-6 py-6 space-y-6 animate-fade-in">
            {/* ── Header ── */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--accent)]/15 border border-[var(--accent)]/30">
                        <History size={18} className="text-[var(--accent)]" />
                    </div>
                    <div>
                        <h1 className="text-sm font-black uppercase tracking-widest text-[var(--foreground)]">{t('orderHistory')}</h1>
                        <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-50">{t('transactionAuditSub')}</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <div className="relative group">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="pos-input px-3 text-xs h-10 w-[160px] cursor-pointer hover:border-[var(--accent)] transition-all bg-[var(--bg-card)] font-black uppercase tracking-widest text-[var(--foreground)]"
                            />
                        </div>
                        <span className="text-[var(--text-secondary)] font-black text-[10px] uppercase tracking-widest opacity-30">TO</span>
                        <div className="relative group">
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="pos-input px-3 text-xs h-10 w-[160px] cursor-pointer hover:border-[var(--accent)] transition-all bg-[var(--bg-card)] font-black uppercase tracking-widest text-[var(--foreground)]"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handlePrintSummary}
                        disabled={loading || !filtered?.length}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[var(--accent-blue)] hover:bg-[var(--accent-blue)] hover:text-white transition-all disabled:opacity-30 font-black text-xs uppercase tracking-widest"
                    >
                        <Printer size={14} />
                        PRINT
                    </button>

                    <button
                        type="button"
                        onClick={handleExport}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-all font-black text-xs uppercase tracking-widest"
                    >
                        <Download size={14} />
                        {t('exportBtn')}
                    </button>

                    <button
                        onClick={loadOrders}
                        className="p-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] hover:bg-[var(--accent)] hover:text-black transition-all group"
                    >
                        <RefreshCw size={15} className={loading ? 'animate-spin' : 'group-active:rotate-180 transition-transform'} />
                    </button>
                </div>
            </div>

            {/* ── Summary Stat Pills ── */}
            <div className="flex flex-wrap gap-3">
                {[
                    { label: t('revenue'), value: formatUsd(totalRevenueCents), accent: 'var(--accent)' },
                    { label: t('open'), value: String(allGroupedOrders.filter(g => g.status === 'open').length), accent: '#f97316' },
                    { label: t('completed'), value: String(completed.length), accent: '#22c55e' },
                    { label: 'HOLD', value: String(allGroupedOrders.filter(g => g.status === 'hold' || g.status === 'pending_payment').length), accent: '#eab308' },
                ].map(pill => (
                    <div key={pill.label} className="pos-card px-4 py-2.5 flex items-center gap-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60">{pill.label}</span>
                        <span className="text-sm font-black font-mono" style={{ color: pill.accent }}>{pill.value}</span>
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={() => setActiveTab('orders')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'orders'
                        ? 'bg-[var(--accent)] text-black shadow-lg shadow-[var(--accent)]/20'
                        : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--foreground)] border border-[var(--border)]'
                        }`}
                >
                    Order History
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('reports')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'reports'
                        ? 'bg-[var(--accent)] text-black shadow-lg shadow-[var(--accent)]/20'
                        : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--foreground)] border border-[var(--border)]'
                        }`}
                >
                    Close Daily Report
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('report-history')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'report-history'
                        ? 'bg-[var(--accent)] text-black shadow-lg shadow-[var(--accent)]/20'
                        : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--foreground)] border border-[var(--border)]'
                        }`}
                >
                    Report History
                </button>
            </div>

            {activeTab === 'reports' && (
            <div className="space-y-4">
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div>
                            <h2 className="text-xs font-black uppercase tracking-[0.22em] text-[var(--foreground)]">Daily Sales Closing</h2>
                            <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-60 mt-1">
                                Review today's sales, record expenses, and close the daily report.
                            </p>
                            <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-60 mt-1">
                                {dailyPreview?.is_closed ? `Status: CLOSED (${dailyPreview.report_date})` : `Status: OPEN (${endDate})`}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--text-secondary)] opacity-70">Today's Sales Summary</h3>
                        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                            <table className="w-full min-w-[640px]">
                                <thead className="bg-[var(--bg-elevated)]">
                                    <tr>
                                        <th className="text-left px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-60">Metric</th>
                                        <th className="text-left px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-60">Value</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-t border-[var(--border)]">
                                        <td className="px-3 py-2 text-xs font-bold text-[var(--foreground)]">Report Date</td>
                                        <td className="px-3 py-2 text-xs font-mono text-[var(--foreground)]">{dailyPreview?.report_date || endDate}</td>
                                    </tr>
                                    <tr className="border-t border-[var(--border)]">
                                        <td className="px-3 py-2 text-xs font-bold text-[var(--foreground)]">Paid Orders</td>
                                        <td className="px-3 py-2 text-xs font-mono text-[var(--foreground)]">{dailyPreview?.paid_orders ?? 0}</td>
                                    </tr>
                                    <tr className="border-t border-[var(--border)]">
                                        <td className="px-3 py-2 text-xs font-bold text-[var(--foreground)]">Total Sales</td>
                                        <td className="px-3 py-2 text-xs font-mono font-black text-[var(--accent)]">{formatUsd(dailyPreview?.total_sales_usd ?? 0)}</td>
                                    </tr>
                                    <tr className="border-t border-[var(--border)] align-top">
                                        <td className="px-3 py-2 text-xs font-bold text-[var(--foreground)]">Paid Receipts</td>
                                        <td className="px-3 py-2">
                                            {allGroupedOrders.length === 0 ? (
                                                <span className="text-xs font-bold text-[var(--text-secondary)] opacity-70">No paid receipts for selected date.</span>
                                            ) : (
                                                <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                                                    <table className="w-full min-w-[420px]">
                                                        <thead className="bg-[var(--bg-card)]">
                                                            <tr>
                                                                <th className="text-left px-2 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-[var(--text-secondary)] opacity-60">Time</th>
                                                                <th className="text-left px-2 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-[var(--text-secondary)] opacity-60">Receipt</th>
                                                                <th className="text-left px-2 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-[var(--text-secondary)] opacity-60">Table</th>
                                                                <th className="text-right px-2 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-[var(--text-secondary)] opacity-60">Amount</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {allGroupedOrders.map((receipt) => (
                                                                <tr key={receipt.id} className="border-t border-[var(--border)]">
                                                                    <td className="px-2 py-1.5 text-[11px] font-mono text-[var(--foreground)]">
                                                                        {new Date(receipt.created_at + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                    </td>
                                                                    <td className="px-2 py-1.5 text-[11px] font-mono font-black text-[var(--foreground)]">
                                                                        {receipt.id.split('-')[0].toUpperCase()}
                                                                    </td>
                                                                    <td className="px-2 py-1.5 text-[11px] font-bold text-[var(--foreground)]">
                                                                        {receipt.table_id || 'Takeout'}
                                                                    </td>
                                                                    <td className="px-2 py-1.5 text-[11px] text-right font-mono font-black text-[var(--accent)]">
                                                                        {formatUsd(receipt.total_usd)}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="space-y-3 relative z-20">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--text-secondary)] opacity-70">Today's Expenses</h3>
                            <button
                                type="button"
                                onClick={addAdjustmentRow}
                                disabled={!!dailyPreview?.is_closed}
                                className="px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-all font-black text-[10px] uppercase tracking-widest"
                            >
                                + Add Expense
                            </button>
                        </div>

                    <div className="overflow-visible">
                        <table className="w-full min-w-[680px] border-separate border-spacing-y-2">
                            <thead>
                                <tr>
                                    <th className="text-left px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-60">Date</th>
                                    <th className="text-left px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-60">Category</th>
                                    <th className="text-left px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-60">Description</th>
                                    <th className="text-left px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-60 w-[180px]">Amount</th>
                                    <th className="px-3 py-2 w-[72px]"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {adjustments.map((row) => (
                                    <tr key={row.id} className="align-top">
                                        <td className="px-1">
                                            <input
                                                type="date"
                                                value={row.date}
                                                onChange={(e) => updateAdjustmentRow(row.id, 'date', e.target.value)}
                                                disabled={!!dailyPreview?.is_closed}
                                                className="pos-input px-3 py-2 h-11 text-xs w-full bg-[var(--bg-elevated)] font-black uppercase tracking-widest text-[var(--foreground)]"
                                            />
                                        </td>
                                        <td className="px-1">
                                            <CustomSelect
                                                value={row.category}
                                                onChange={(value) => updateAdjustmentRow(row.id, 'category', value)}
                                                options={EXPENSE_CATEGORIES.map((cat) => ({ label: cat, value: cat }))}
                                                disabled={!!dailyPreview?.is_closed}
                                                className="relative z-30 h-11"
                                            />
                                        </td>
                                        <td className="px-1">
                                            <input
                                                type="text"
                                                value={row.description}
                                                onChange={(e) => updateAdjustmentRow(row.id, 'description', e.target.value)}
                                                disabled={!!dailyPreview?.is_closed}
                                                placeholder="Vegetables purchase, gas refill, delivery..."
                                                className="pos-input px-3 py-2 h-11 text-xs w-full bg-[var(--bg-elevated)] font-black text-[var(--foreground)]"
                                            />
                                        </td>
                                        <td className="px-1">
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={row.price}
                                                onChange={(e) => updateAdjustmentRow(row.id, 'price', e.target.value)}
                                                disabled={!!dailyPreview?.is_closed}
                                                placeholder="0.00"
                                                className="pos-input px-3 py-2 h-11 text-xs w-full bg-[var(--bg-elevated)] font-black font-mono text-[var(--foreground)]"
                                            />
                                        </td>
                                        <td className="px-1 text-right">
                                            <button
                                                type="button"
                                                onClick={() => removeAdjustmentRow(row.id)}
                                                disabled={!!dailyPreview?.is_closed}
                                                className="h-11 px-3 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-all font-black text-[10px] uppercase tracking-widest"
                                            >
                                                Remove
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    </div>

                    <div className="space-y-3 pt-1 relative z-0">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--text-secondary)] opacity-70">Inventory Usage Summary</h3>
                        {inventoryUsageRows.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-4 text-[11px] font-bold text-[var(--text-secondary)] opacity-70">
                                No linked inventory usage found for completed sales on this date.
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                                <table className="w-full min-w-[680px]">
                                    <thead className="bg-[var(--bg-elevated)]">
                                        <tr>
                                            <th className="text-left px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-60">Inventory Item</th>
                                            <th className="text-left px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-60">Used Qty</th>
                                            <th className="text-left px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-60">Cost / Unit</th>
                                            <th className="text-left px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-60">Total Cost</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {inventoryUsageRows.map((item) => (
                                            <tr key={item.inventory_item_id} className="border-t border-[var(--border)]">
                                                <td className="px-3 py-2 text-xs font-bold text-[var(--foreground)]">{item.inventory_item_name}</td>
                                                <td className="px-3 py-2 text-xs font-mono text-[var(--foreground)]">{item.used_quantity.toFixed(2)} {item.unit_label}</td>
                                                <td className="px-3 py-2 text-xs font-mono text-[var(--foreground)]">${item.cost_per_unit.toFixed(2)}</td>
                                                <td className="px-3 py-2 text-xs font-mono font-black text-[var(--accent)]">{formatUsd(item.total_cost_usd)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="space-y-3 pt-1">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--text-secondary)] opacity-70">Business Summary</h3>
                        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                            <table className="w-full min-w-[760px]">
                                <thead className="bg-[var(--bg-elevated)]">
                                    <tr>
                                        <th className="text-left px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-60">Metric</th>
                                        <th className="text-left px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-60">Value</th>
                                        <th className="text-left px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-60">Edit</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-t border-[var(--border)]">
                                        <td className="px-3 py-2 text-xs font-bold text-[var(--foreground)]">Total Sales</td>
                                        <td className="px-3 py-2 text-xs font-mono font-black text-[var(--foreground)]">{formatUsd(totalSalesCents)}</td>
                                        <td className="px-3 py-2 text-xs font-bold text-[var(--text-secondary)] opacity-70">Auto (from paid orders)</td>
                                    </tr>
                                    <tr className="border-t border-[var(--border)]">
                                        <td className="px-3 py-2 text-xs font-bold text-[var(--foreground)]">Total Expenses</td>
                                        <td className="px-3 py-2 text-xs font-mono font-black text-orange-400">{formatUsd(adjustmentTotalCents)}</td>
                                        <td className="px-3 py-2 text-xs font-bold text-[var(--text-secondary)] opacity-70">Editable in Today's Expenses table</td>
                                    </tr>
                                    <tr className="border-t border-[var(--border)]">
                                        <td className="px-3 py-2 text-xs font-bold text-[var(--foreground)]">Inventory Usage Cost</td>
                                        <td className="px-3 py-2 text-xs font-mono font-black text-sky-300">{formatUsd(inventoryUsageCostCents)}</td>
                                        <td className="px-3 py-2 text-xs font-bold text-[var(--text-secondary)] opacity-70">Auto (from linked inventory usage)</td>
                                    </tr>
                                    <tr className="border-t border-[var(--border)] bg-emerald-500/10">
                                        <td className="px-3 py-2 text-xs font-black text-emerald-200">Operational Profit</td>
                                        <td className="px-3 py-2 text-xs font-mono font-black text-emerald-300">{formatUsd(netProfitCents)}</td>
                                        <td className="px-3 py-2 text-xs font-bold text-emerald-200/80">Total Sales - Total Expenses</td>
                                    </tr>
                                    <tr className="border-t border-[var(--border)] bg-violet-500/10">
                                        <td className="px-3 py-2 text-xs font-black text-violet-200">Estimated Profit After Inventory</td>
                                        <td className="px-3 py-2 text-xs font-mono font-black text-violet-300">{formatUsd(estimatedProfitAfterInventoryCents)}</td>
                                        <td className="px-3 py-2 text-xs font-bold text-violet-200/80">Operational Profit - Inventory Usage Cost</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-60">Inventory Usage Cost is estimated from linked recipe usage of completed sales for the selected date. Estimated Profit After Inventory = Operational Profit - Inventory Usage Cost.</p>
                    </div>

                    <div className="space-y-2 pt-1">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--text-secondary)] opacity-70">Daily Notes</h3>
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-60">Daily Notes</label>
                        <textarea
                            value={reportNotes}
                            onChange={(e) => setReportNotes(e.target.value)}
                            rows={4}
                            disabled={!!dailyPreview?.is_closed}
                            placeholder="Kitchen equipment repaired. Supplier delivery delayed."
                            className="pos-input px-3 py-2 text-xs w-full bg-[var(--bg-elevated)] font-bold text-[var(--foreground)]"
                        />
                    </div>

                    <div className="space-y-3 border-t border-[var(--border)] mt-3 pt-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--text-secondary)] opacity-70">Actions</h3>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={handleSaveDraft}
                                disabled={!!dailyPreview?.is_closed}
                                className="px-4 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-all disabled:opacity-40 font-black text-xs uppercase tracking-widest"
                            >
                                Save Draft
                            </button>
                            <button
                                type="button"
                                onClick={handlePrintPreview}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--accent-blue)] hover:bg-[var(--accent-blue)] hover:text-white transition-all font-black text-xs uppercase tracking-widest"
                            >
                                <Printer size={14} />
                                Print Preview
                            </button>
                            <button
                                onClick={handleCloseReport}
                                disabled={closingReport || loading || !allGroupedOrders?.length || !!dailyPreview?.is_closed}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent)] text-black hover:brightness-110 transition-all disabled:opacity-30 font-black text-xs uppercase tracking-widest"
                            >
                                <Printer size={14} />
                                {closingReport ? 'Closing...' : 'Close Report'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            )}

            {activeTab === 'report-history' && (
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h2 className="text-xs font-black uppercase tracking-[0.22em] text-[var(--foreground)]">Report History</h2>
                        <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-60 mt-1">
                            Closed reports for the selected date range.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            type="text"
                            value={reportSearch}
                            onChange={(e) => setReportSearch(e.target.value)}
                            placeholder="Search by date, cashier, status..."
                            className="pos-input h-10 px-3 text-xs w-[220px] bg-[var(--bg-elevated)] font-bold text-[var(--foreground)]"
                        />
                        <div className="flex flex-wrap gap-2">
                            {[
                                { id: 'all', label: 'All' },
                                { id: 'closed', label: 'Closed' },
                            ].map(item => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setReportFilter(item.id as ReportFilter)}
                                    className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${reportFilter === item.id
                                        ? 'bg-[var(--accent)] text-black shadow-lg shadow-[var(--accent)]/20'
                                        : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--foreground)] border border-[var(--border)]'
                                        }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {filteredReports.length === 0 ? (
                        <div className="lg:col-span-2 flex items-center justify-center py-16 opacity-40 border border-dashed border-[var(--border)] rounded-2xl">
                            <div className="text-center space-y-2">
                                <ReceiptText size={28} className="mx-auto" />
                                <p className="text-xs font-black uppercase tracking-widest">No reports matched this filter</p>
                            </div>
                        </div>
                    ) : filteredReports.map(report => (
                        <div key={report.id} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-widest text-[var(--foreground)]">{report.report_date}</h3>
                                    <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-60 mt-1">
                                        {report.paid_orders} paid orders
                                    </p>
                                </div>
                                <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                    {report.status}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[10px] font-black uppercase tracking-widest">
                                <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] px-3 py-2">
                                    <span className="block text-[var(--text-secondary)] opacity-50">USD</span>
                                    <span className="block mt-1 text-[var(--accent)] text-sm">{formatUsd(report.total_sales_usd)}</span>
                                </div>
                                <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] px-3 py-2">
                                    <span className="block text-[var(--text-secondary)] opacity-50">KHR</span>
                                    <span className="block mt-1 text-[var(--foreground)] text-sm">{formatKhr(report.total_sales_khr)}</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-widest opacity-70">
                                <span>Total Expenses {formatUsd(report.total_expenses_usd)}</span>
                                <span>Net Profit {formatUsd(report.net_profit_usd)}</span>
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-1">
                                <span className="text-[10px] font-bold text-[var(--text-secondary)] opacity-60">
                                    Closed by {report.cashier_name || 'Unknown'}
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleExportDailyReport(report)}
                                        className="px-3 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:border-[var(--accent)] font-black text-[10px] uppercase tracking-widest transition-all"
                                    >
                                        Export
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handlePrintDailyReport(report)}
                                        className="px-3 py-2 rounded-xl bg-[var(--accent)] text-black font-black text-[10px] uppercase tracking-widest hover:brightness-110 transition-all"
                                    >
                                        Print
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            )}

            {activeTab === 'orders' && (
            /* ── Tabs & Content ── */
            <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex gap-2 overflow-x-auto pb-2 container-snap">
                        {STATUS_TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setFilter(tab.id)}
                                className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${filter === tab.id
                                    ? 'bg-[var(--accent)] text-black shadow-lg shadow-[var(--accent)]/20'
                                    : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--foreground)] border border-[var(--border)]'
                                    }`}
                            >
                                {t(tab.labelKey)}
                                <span className={`ml-2 px-1.5 py-0.5 rounded-lg text-[10px] ${filter === tab.id ? 'bg-black/10' : 'bg-[var(--bg-elevated)]'}`}>
                                    {allGroupedOrders.filter(g => tab.id === 'all' || g.status === tab.id).length}
                                </span>
                            </button>
                        ))}
                    </div>
                    {/* View mode toggle */}
                    <div className="flex items-center gap-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-1 flex-shrink-0">
                        <button
                            onClick={() => setViewMode('table')}
                            title="Table view"
                            className={`p-1.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-[var(--accent)] text-black' : 'text-[var(--text-secondary)] hover:text-[var(--foreground)]'}`}
                        >
                            <LayoutList size={15} strokeWidth={2.5} />
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            title="Receipt grid view"
                            className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-[var(--accent)] text-black' : 'text-[var(--text-secondary)] hover:text-[var(--foreground)]'}`}
                        >
                            <LayoutGrid size={15} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                {viewMode === 'table' ? (
                    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-2xl relative">
                        <div className="overflow-x-auto container-snap">
                            <table className="w-full text-left">
                                <thead className="bg-[var(--bg-elevated)] border-b border-[var(--border)]">
                                    <tr>
                                        <th className="px-4 py-2.5 w-12"></th>
                                        {[t('receiptId'), t('timestamp'), t('tableLabel'), t('orderStatus'), t('totalUsd'), t('totalKhr')].map(h => (
                                            <th
                                                key={h}
                                                className="px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-60"
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border)]">
                                    {loading && filtered.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-16 text-center">
                                                <RefreshCw size={24} className="animate-spin mx-auto opacity-20" />
                                            </td>
                                        </tr>
                                    ) : filtered.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-16 text-center opacity-30 font-black uppercase tracking-[0.2em] text-xs">
                                                {t('noMatchingTransactions')}
                                            </td>
                                        </tr>
                                    ) : (
                                        filtered.map((g) => {
                                            const isExpanded = expandedRows.includes(g.id);
                                            const style = STATUS_STYLES[g.status] ?? STATUS_STYLES['completed'];

                                            return (
                                                <React.Fragment key={g.id}>
                                                    <tr
                                                        onClick={() => toggleRow(g.id)}
                                                        className={`transition-all hover:bg-[var(--bg-elevated)] cursor-pointer group ${isExpanded ? 'bg-[var(--bg-elevated)]' : ''}`}
                                                    >
                                                        <td className="px-4 py-2.5">
                                                            <div className={`w-6 h-6 flex items-center justify-center rounded-lg transition-all ${isExpanded ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] group-hover:bg-[var(--accent)]/10 group-hover:text-[var(--accent)]'}`}>
                                                                {isExpanded ? <ChevronUp size={13} strokeWidth={3} /> : <ChevronDown size={13} strokeWidth={3} />}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-2.5 font-mono text-xs font-black tracking-widest" style={{ color: isExpanded ? 'var(--accent)' : 'inherit' }}>
                                                            {g.table_id ? `SESSION ${g.id.split('-')[0].toUpperCase()}` : `#${g.id.split('-')[0].toUpperCase()}`}
                                                        </td>
                                                        <td className="px-4 py-2.5">
                                                            <div className="text-xs font-black mb-0.5">{new Date(g.created_at + 'Z').toLocaleDateString()}</div>
                                                            <div className="text-[10px] font-bold font-mono opacity-40 flex items-center gap-1">
                                                                <Clock size={10} />
                                                                {new Date(g.created_at + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-2.5">
                                                            {g.table_id ? (
                                                                <span className="flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg bg-[var(--accent)]/5 border border-[var(--accent)]/20 text-[var(--accent)] w-fit uppercase tracking-widest">
                                                                    <TableProperties size={10} />
                                                                    {g.table_id}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] font-black opacity-20 uppercase tracking-widest">{t('takeout')}</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2.5">
                                                            <span
                                                                className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border"
                                                                style={{ background: style.bg, color: style.text, borderColor: style.border }}
                                                            >
                                                                {['hold', 'pending_payment'].includes(g.status) ? 'HOLD' : t(g.status as any)}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2.5 font-mono font-black text-sm" style={{ color: 'var(--accent)' }}>
                                                            <div>
                                                                {formatUsd(g.total_usd)}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-2.5 font-mono text-xs opacity-60 font-black">
                                                            <div>
                                                                {formatKhr(g.total_khr)}
                                                            </div>
                                                        </td>
                                                    </tr>

                                                    {isExpanded && (
                                                        <tr className="bg-[var(--bg-dark)] animate-fade-in border-l-2 border-[var(--accent)]">
                                                            <td colSpan={7} className="px-5 py-4">
                                                                <div className="space-y-4">
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="flex items-center gap-2">
                                                                            <ReceiptText size={14} className="text-[var(--accent)]" />
                                                                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent)]">Master Table Receipt</h4>
                                                                        </div>
                                                                        <div className="flex items-center gap-4">
                                                                            {user && canDelete(user.role) && (
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleDeleteGroup(g);
                                                                                    }}
                                                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/10 border border-red-600/30 text-red-500 font-black text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all"
                                                                                >
                                                                                    <Trash2 size={12} />
                                                                                    {t('deleteHistory') || 'Delete Group'}
                                                                                </button>
                                                                            )}
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    if (restaurant) {
                                                                                        const allItems = combineOrderItems(g.orders.flatMap(o => orderDetails[o.id] || []));
                                                                                        printReceipt({
                                                                                            restaurant,
                                                                                            orderId: g.id,
                                                                                            tableId: g.table_id || undefined,
                                                                                            customerName: undefined,
                                                                                            customerPhone: undefined,
                                                                                            items: allItems,
                                                                                            payments: [],
                                                                                            totals: {
                                                                                                subtotalCents: g.total_usd - g.total_vat - g.total_plt,
                                                                                                vatCents: g.total_vat,
                                                                                                pltCents: g.total_plt,
                                                                                                totalUsdCents: g.total_usd,
                                                                                                totalKhr: g.total_khr
                                                                                            }
                                                                                        });
                                                                                    }
                                                                                }}
                                                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-black font-black text-[10px] uppercase tracking-widest hover:brightness-110 transition-all"
                                                                            >
                                                                                <ReceiptText size={12} />
                                                                                Print Master Receipt
                                                                            </button>
                                                                        </div>
                                                                    </div>

                                                                    <div className="space-y-3">
                                                                        {g.orders.map((o, index) => (
                                                                            <div key={o.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3">
                                                                                <div className="flex items-center justify-between mb-3 border-b border-[var(--border)] pb-2 text-[10px] font-black uppercase tracking-widest opacity-60">
                                                                                    <span>{g.table_id ? `Round ${index + 1}` : 'Order Segment'} - #{o.id.split('-')[0].toUpperCase()}</span>
                                                                                    <span>{new Date(o.created_at + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                                                </div>

                                                                                {orderDetails[o.id] ? (
                                                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                                                                        {orderDetails[o.id].map(item => (
                                                                                            <div key={item.id} className="flex items-center justify-between bg-[var(--bg-dark)] px-3 py-2.5 rounded-lg border border-[var(--border)] transition-all">
                                                                                                <div className="flex items-center gap-3">
                                                                                                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center flex-shrink-0">
                                                                                                        {getImageSrc(item.image_path) ? (
                                                                                                            <img
                                                                                                                src={getImageSrc(item.image_path)!}
                                                                                                                alt={lang === 'km' && item.product_khmer ? item.product_khmer : item.product_name}
                                                                                                                className="w-full h-full object-cover"
                                                                                                            />
                                                                                                        ) : (
                                                                                                            <div className="w-full h-full flex items-center justify-center font-black text-[var(--accent)] text-xs">
                                                                                                                {item.quantity}x
                                                                                                            </div>
                                                                                                        )}
                                                                                                    </div>
                                                                                                    <div className="min-w-0">
                                                                                                        <div className="flex items-center gap-2">
                                                                                                            <span className="inline-flex items-center justify-center min-w-8 h-6 px-1.5 rounded-md bg-[var(--bg-card)] border border-[var(--border)] font-black text-[var(--accent)] text-[10px] flex-shrink-0">
                                                                                                                {item.quantity}x
                                                                                                            </span>
                                                                                                            <p className="text-xs font-black text-[var(--foreground)] leading-tight truncate">{lang === 'km' && item.product_khmer ? item.product_khmer : item.product_name}</p>
                                                                                                        </div>
                                                                                                        <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-70 uppercase tracking-widest mt-0.5">{formatUsd(item.price_at_order)} / unit</p>
                                                                                                    </div>
                                                                                                </div>
                                                                                                <div className="text-right flex-shrink-0">
                                                                                                    <p className="text-xs font-black text-[var(--foreground)]">{formatUsd(item.price_at_order * item.quantity)}</p>
                                                                                                </div>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="flex items-center justify-center p-4">
                                                                                        <RefreshCw size={14} className="animate-spin opacity-30" />
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    /* ── Receipt Grid View ── */
                    filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-3 opacity-30">
                            <ReceiptText size={36} />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">{t('noMatchingTransactions')}</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-fade-in">
                            {filtered.map(g => {
                                const style = STATUS_STYLES[g.status] ?? STATUS_STYLES['completed'];
                                const items = combineOrderItems(g.orders.flatMap(o => orderDetails[o.id] || []));
                                const isLoaded = g.orders.every(o => orderDetails[o.id] !== undefined);

                                const dt = new Date(g.created_at + 'Z');
                                return (
                                    <div
                                        key={g.id}
                                        className="flex flex-col bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden hover:border-[var(--accent)]/40 transition-all shadow-xl"
                                    >
                                        {/* Receipt tape top */}
                                        <div
                                            className="h-1.5 w-full"
                                            style={{ background: `linear-gradient(90deg, ${style.text}55 0%, ${style.text} 50%, ${style.text}55 100%)` }}
                                        />

                                        {/* Header */}
                                        <div className="px-4 pt-4 pb-3 border-b border-dashed border-[var(--border)]">
                                            <div className="flex items-start justify-between mb-2">
                                                <span
                                                    className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border"
                                                    style={{ background: style.bg, color: style.text, borderColor: style.border }}
                                                >
                                                    {['hold', 'pending_payment'].includes(g.status) ? 'HOLD' : t(g.status as any)}
                                                </span>
                                                {g.table_id ? (
                                                    <span className="flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-md bg-[var(--accent)]/10 border border-[var(--accent)]/25 text-[var(--accent)] uppercase tracking-widest">
                                                        <TableProperties size={9} />
                                                        {g.table_id}
                                                    </span>
                                                ) : (
                                                    <span className="text-[9px] font-black opacity-25 uppercase tracking-widest">{t('takeout')}</span>
                                                )}
                                            </div>
                                            <p className="font-mono text-xs font-black text-[var(--accent)] tracking-widest">
                                                {g.table_id ? `SESSION ${g.id.split('-')[0].toUpperCase()}` : `#${g.id.split('-')[0].toUpperCase()}`}
                                            </p>
                                            <div className="flex items-center gap-1.5 mt-1 text-[var(--text-secondary)] opacity-50">
                                                <Clock size={10} />
                                                <span className="text-[10px] font-mono font-bold">
                                                    {dt.toLocaleDateString()} · {dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <div className="mt-2 text-[9px] font-black opacity-30 uppercase tracking-[0.1em]">
                                                {g.orders.length} Rounds
                                            </div>
                                        </div>

                                        {/* Items */}
                                        <div className="flex-1 px-4 py-3 space-y-1.5 min-h-[80px]">
                                            {isLoaded ? (
                                                items.length === 0 ? (
                                                    <p className="text-[10px] opacity-20 font-black uppercase tracking-widest text-center py-2">{t('emptyOrder')}</p>
                                                ) : (
                                                    items.slice(0, 10).map((item, idx) => (
                                                        <div key={item.product_id} className="flex flex-col mb-2 last:mb-0">
                                                            <div className="flex items-start justify-between text-[11px]">
                                                                <div className="flex items-start gap-2 min-w-0">
                                                                    <span className="font-mono font-black text-[var(--accent)] w-7 text-right flex-shrink-0 mt-0.5">
                                                                        {item.quantity}×
                                                                    </span>
                                                                    <div className="flex flex-col min-w-0">
                                                                        <span className="font-medium truncate text-[var(--foreground)] opacity-90">
                                                                            {lang === 'km' && item.product_khmer ? item.product_khmer : item.product_name}
                                                                        </span>
                                                                        <span className="text-[9px] font-mono opacity-40 mt-0.5">
                                                                            {formatUsd(item.price_at_order)} / unit
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <span className="font-mono font-black text-[var(--foreground)] opacity-90 flex-shrink-0 ml-2 mt-0.5">
                                                                    {formatUsd(item.price_at_order * item.quantity)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )).concat(items.length > 10 ? [
                                                        <div key="more" className="text-center pt-2 text-[9px] font-black uppercase opacity-30">
                                                            + {items.length - 10} more items
                                                        </div>
                                                    ] : [])
                                                )
                                            ) : (
                                                <div className="flex items-center justify-center py-4 opacity-25">
                                                    <RefreshCw size={16} className="animate-spin" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Customer info for HOLD receipts */}
                                        {(g.status === 'hold' || g.status === 'pending_payment') && (() => {
                                            const holdOrder = g.orders[0];
                                            const name = holdOrder?.customer_name;
                                            const phone = holdOrder?.customer_phone;
                                            if (!name && !phone) return null;
                                            return (
                                                <div className="mx-4 mb-2 px-3 py-2 rounded-xl border border-yellow-500/20 bg-yellow-500/5 space-y-1">
                                                    {name && <p className="text-[10px] font-black text-yellow-400 uppercase tracking-widest">👤 {name}</p>}
                                                    {phone && <p className="text-[10px] font-bold text-yellow-300/70 font-mono">📞 {phone}</p>}
                                                </div>
                                            );
                                        })()}

                                        {/* Totals */}
                                        <div className="px-4 pt-2.5 pb-3 border-t border-dashed border-[var(--border)] space-y-1">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black uppercase tracking-widest opacity-40">{t('total')}</span>
                                                <span
                                                    className="font-mono font-black text-sm text-[var(--accent)]"
                                                >
                                                    <span>
                                                        {formatUsd(g.total_usd)}
                                                    </span>
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black uppercase tracking-widest opacity-25">{t('khr')}</span>
                                                <span className={`font-mono text-[10px] font-bold opacity-40`}>
                                                    {formatKhr(g.total_khr)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Print and Delete buttons */}
                                        <div className="px-3 pb-3 flex items-center gap-2">
                                            {user && canDelete(user.role) && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteGroup(g);
                                                    }}
                                                    title={t('deleteHistory') || 'Delete Group'}
                                                    className="flex-shrink-0 flex items-center justify-center p-2 rounded-xl bg-red-600/10 border border-red-600/30 text-red-500 hover:bg-red-600 hover:text-white transition-all h-9 w-9"
                                                >
                                                    <Trash2 size={13} strokeWidth={2.5} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => {
                                                    if (restaurant && isLoaded) {
                                                        printReceipt({
                                                            restaurant,
                                                            orderId: g.id,
                                                            tableId: g.table_id || undefined,
                                                            customerName: undefined,
                                                            customerPhone: undefined,
                                                            items,
                                                            payments: [],
                                                            totals: {
                                                                subtotalCents: g.total_usd,
                                                                vatCents: 0,
                                                                pltCents: 0,
                                                                totalUsdCents: g.total_usd,
                                                                totalKhr: g.total_khr
                                                            }
                                                        });
                                                    }
                                                }}
                                                disabled={!isLoaded || !restaurant}
                                                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--accent)] hover:text-black hover:border-[var(--accent)] transition-all font-black text-[10px] uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed h-9"
                                            >
                                                <Printer size={11} strokeWidth={2.5} />
                                                {t('printReceipt')}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
            </div>
            )}
        </div>
    );
}
