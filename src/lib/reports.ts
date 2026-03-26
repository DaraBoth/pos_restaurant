import { Restaurant, Order } from '@/types';
import { formatUsd, formatKhr } from '@/lib/currency';
import { format, parseISO } from 'date-fns';

export interface ReportSummaryPayload {
    restaurant: Restaurant;
    startDate: string;
    endDate: string;
    orders: any[]; // Grouped orders from HistoryPage
    totalUsd: number;
    totalKhr: number;
}

function escapeHtml(value: string) {
    return (value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function getReportHtml(payload: ReportSummaryPayload): string {
    const { restaurant, startDate, endDate, orders, totalUsd, totalKhr } = payload;
    
    const logoHtml = restaurant.logo_path
        ? `<img src="${restaurant.logo_path}" style="max-width: 150px; max-height: 100px; margin-bottom: 15px; filter: grayscale(1);" />`
        : '';

    const orderRows = orders.map((g, idx) => {
        // Handle SQLite space separator
        const startIso = g.created_at.replace(' ', 'T') + 'Z';
        const startTime = format(parseISO(startIso), 'HH:mm');
        
        // Find latest completion time in the group
        let checkoutTime = '—';
        if (g.orders && g.orders.length > 0) {
            const lastOrder = g.orders[g.orders.length - 1];
            if (lastOrder.completed_at) {
                const endIso = lastOrder.completed_at.replace(' ', 'T') + 'Z';
                checkoutTime = format(parseISO(endIso), 'HH:mm');
            }
        }

        return `
            <tr>
                <td>${idx + 1}</td>
                <td>${escapeHtml(g.id.split('-')[0].toUpperCase())}</td>
                <td>${escapeHtml(g.table_id || 'Takeout')}</td>
                <td>${startTime}</td>
                <td>${checkoutTime}</td>
                <td style="text-align: right; font-weight: bold;">${formatUsd(g.total_usd)}</td>
            </tr>
        `;
    }).join('');

    const rangeStr = startDate === endDate 
        ? format(parseISO(startDate), 'dd MMM yyyy')
        : `${format(parseISO(startDate), 'dd MMM')} - ${format(parseISO(endDate), 'dd MMM yyyy')}`;

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <title>Daily Summary Report</title>
    <style>
        @page { size: A4; margin: 20mm; }
        body {
            font-family: 'Inter', -apple-system, sans-serif;
            color: #1a1a1a;
            line-height: 1.5;
            margin: 0;
            padding: 0;
            background: #fff;
        }
        .container { max-width: 210mm; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #333; padding-bottom: 20px; }
        .biz-name { font-size: 28px; font-weight: 900; color: #000; margin: 5px 0; }
        .report-title { font-size: 18px; color: #666; text-transform: uppercase; letter-spacing: 2px; margin-top: 10px; }
        
        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
        .meta-box { background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #eee; }
        .meta-label { font-size: 10px; text-transform: uppercase; color: #888; letter-spacing: 1px; margin-bottom: 4px; }
        .meta-value { font-size: 16px; font-weight: 700; color: #111; }

        table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
        th { text-align: left; padding: 12px 8px; border-bottom: 2px solid #333; font-size: 12px; text-transform: uppercase; color: #444; }
        td { padding: 12px 8px; border-bottom: 1px solid #eee; font-size: 13px; }
        tr:nth-child(even) { background: #fafafa; }

        .summary-footer { display: flex; justify-content: flex-end; }
        .summary-card { background: #1a1a1a; color: #fff; padding: 25px; border-radius: 12px; min-width: 300px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
        .summary-row { display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; }
        .summary-row:last-child { border: none; margin-bottom: 0; padding-bottom: 0; margin-top: 5px; }
        .summary-label { font-size: 12px; opacity: 0.7; }
        .summary-value { font-size: 18px; font-weight: 800; }
        .grand-total { font-size: 24px; color: #22c55e; }

        @media print {
            .summary-card { border: 2px solid #000; box-shadow: none; background: #fff !important; color: #000 !important; }
            .summary-row { border-color: #eee; }
            .grand-total { color: #000; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            ${logoHtml}
            <div class="biz-name">${escapeHtml(restaurant.name)}</div>
            ${restaurant.khmer_name ? `<div style="font-size: 20px; font-weight: 700;">${escapeHtml(restaurant.khmer_name)}</div>` : ''}
            <div class="report-title">Daily Earnings Summary</div>
        </div>

        <div class="meta-grid">
            <div class="meta-box">
                <div class="meta-label">Selected Period</div>
                <div class="meta-value">${rangeStr}</div>
            </div>
            <div class="meta-box" style="text-align: right;">
                <div class="meta-label">Generated On</div>
                <div class="meta-value">${format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th style="width: 40px;">#</th>
                    <th>Ref ID</th>
                    <th>Table</th>
                    <th>Start</th>
                    <th>Checkout</th>
                    <th style="text-align: right;">Total Gross</th>
                </tr>
            </thead>
            <tbody>
                ${orderRows}
            </tbody>
        </table>

        <div class="summary-footer">
            <div class="summary-card">
                <div class="summary-row">
                    <span class="summary-label">Total Transactions</span>
                    <span class="summary-value">${orders.length}</span>
                </div>
                <div class="summary-row">
                    <span class="summary-label">Total Revenue (KHR)</span>
                    <span class="summary-value">៛${totalKhr.toLocaleString()}</span>
                </div>
                <div class="summary-row">
                    <span class="summary-label">TOTAL EARNINGS</span>
                    <span class="summary-value grand-total">${formatUsd(totalUsd)}</span>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;
}

export function printSummaryReport(payload: ReportSummaryPayload) {
    if (typeof window === 'undefined') return;

    const html = getReportHtml(payload);
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) {
        document.body.removeChild(iframe);
        return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    iframe.onload = () => {
        setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            setTimeout(() => {
                if (document.body.contains(iframe)) document.body.removeChild(iframe);
            }, 1000);
        }, 500);
    };
}
