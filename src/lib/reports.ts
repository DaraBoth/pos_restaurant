import { DailyReportDetail, Restaurant, TopProduct } from '@/types';
import { formatUsd, formatKhr } from '@/lib/currency';
import { dispatchThermalPrint } from '@/lib/receipt';
import { format, isValid, parseISO } from 'date-fns';

export type SalesSummaryTemplate = 'default' | 'khmer';

export interface SalesSummaryGroup {
    id: string;
    table_id: string | null;
    status: string;
    created_at: string;
    total_usd: number;
    total_khr: number;
    total_vat: number;
    total_plt: number;
}

export interface SalesSummaryAdjustment {
  date: string;
  info: string;
  price_cents: number;
}

export interface SalesSummaryPayload {
    restaurant: Restaurant;
    startDate: string;
    endDate: string;
    groups: SalesSummaryGroup[];
    cashierName?: string;
    topItems?: TopProduct[];
  adjustments?: SalesSummaryAdjustment[];
}

function escapeHtml(value: string) {
    return (value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function parseSqliteTs(ts: string): Date {
  const parsed = parseISO(ts.replace(' ', 'T') + (ts.endsWith('Z') ? '' : 'Z'));
  return isValid(parsed) ? parsed : new Date(0);
}

function rangeLabel(startDate: string, endDate: string): string {
  const start = parseISO(startDate);
  const end = parseISO(endDate);

  if (!isValid(start) || !isValid(end)) {
    return `${startDate || 'Unknown'} – ${endDate || 'Unknown'}`;
  }

  if (startDate === endDate) {
    return format(start, 'dd MMM yyyy');
    }
  return `${format(start, 'dd MMM')} – ${format(end, 'dd MMM yyyy')}`;
}

function formatSafe(date: Date, pattern: string, fallback: string): string {
  return isValid(date) ? format(date, pattern) : fallback;
}

interface SummaryLabels {
    docType: string;
    period: string;
    generated: string;
    operator: string;
    transactions: string;
    completed: string;
    open: string;
    hold: string;
    topItemsHeader: string;
    adjustmentsHeader: string;
    ordersHeader: string;
    adjDate: string;
    adjInfo: string;
    adjPrice: string;
    adjustmentTotal: string;
    netCash: string;
    colTime: string;
    colRef: string;
    colTbl: string;
    colTotal: string;
    colName: string;
    colQty: string;
    colRevenue: string;
    subtotal: string;
    vat: string;
    plt: string;
    grossUsd: string;
    grossKhr: string;
    completedOnly: string;
    avgOrder: string;
    endOfReport: string;
    legend: string;
    noTransactions: string;
    takeoutShort: string;
}

const LABELS: Record<SalesSummaryTemplate, SummaryLabels> = {
    default: {
        docType: 'Sales Summary',
        period: 'Period',
        generated: 'Generated',
        operator: 'Operator',
        transactions: 'Transactions',
        completed: 'Completed',
        open: 'Open',
        hold: 'Hold',
        topItemsHeader: 'Top Items',
        adjustmentsHeader: 'Adjustments',
        ordersHeader: 'Orders',
        adjDate: 'DATE',
        adjInfo: 'INFO',
        adjPrice: 'PRICE',
        adjustmentTotal: 'Adjustments total',
        netCash: 'Net cash after expenses',
        colTime: 'TIME',
        colRef: 'REF',
        colTbl: 'TBL',
        colTotal: 'TOTAL',
        colName: 'NAME',
        colQty: 'QTY',
        colRevenue: 'REVENUE',
        subtotal: 'Subtotal',
        vat: 'VAT (10%)',
        plt: 'PLT (3%)',
        grossUsd: 'GROSS USD',
        grossKhr: 'GROSS KHR',
        completedOnly: 'Completed only',
        avgOrder: 'Avg / order',
        endOfReport: '— End of report —',
        legend: '·O = open · ·H = hold · TKO = takeout',
        noTransactions: 'No transactions in this period',
        takeoutShort: 'TKO',
    },
    khmer: {
        docType: 'របាយការណ៍លក់ប្រចាំថ្ងៃ',
        period: 'កាលបរិច្ឆេទ',
        generated: 'ពេលបោះពុម្ព',
        operator: 'ផ្តល់ដោយ',
        transactions: 'ប្រតិបត្តិការ',
        completed: 'បានបញ្ចប់',
        open: 'បើក',
        hold: 'ផ្អាក',
        topItemsHeader: '❋ មុខទំនិញ​លក់ដាច់ ❋',
        adjustmentsHeader: '❋ ការកែតម្រូវ ❋',
        ordersHeader: '❋ បញ្ជី​ការ​លក់ ❋',
        adjDate: 'កាលបរិច្ឆេទ',
        adjInfo: 'ព័ត៌មាន',
        adjPrice: 'តម្លៃ',
        adjustmentTotal: 'សរុបការកែតម្រូវ',
        netCash: 'ប្រាក់សុទ្ធក្រោយដកចំណាយ',
        colTime: 'ម៉ោង',
        colRef: 'លេខ',
        colTbl: 'តុ',
        colTotal: 'សរុប',
        colName: 'ឈ្មោះ',
        colQty: 'ចំនួន',
        colRevenue: 'តម្លៃ',
        subtotal: 'អនុ​សរុប',
        vat: 'ពន្ធ VAT',
        plt: 'ពន្ធ PLT',
        grossUsd: 'សរុបជាដុល្លារ',
        grossKhr: 'សរុបជារៀល',
        completedOnly: 'បានបញ្ចប់សរុប',
        avgOrder: 'មធ្យម/លក់',
        endOfReport: '❋ សូម​អរគុណ ❋',
        legend: '·O = បើក · ·H = ផ្អាក · TKO = នាំទៅ',
        noTransactions: 'គ្មាន​ការ​លក់​ក្នុង​ថ្ងៃ​នេះ',
        takeoutShort: 'TKO',
    },
};

/**
 * Thermal-format end-of-day / range sales summary.
 *
 * NOT the same as an order receipt — this is the "Z report" style document
 * a cashier prints at close to reconcile against the till. Same paper width
 * options (58mm / 80mm), same @page rules and cutter clearance as receipt.ts.
 *
 * Two visual templates:
 *   - 'default': English-leaning labels, suits owners reading in English
 *   - 'khmer':   Khmer-prominent — Khmer name first, Khmer labels everywhere,
 *                decorative section headers. Suited to Khmer-speaking
 *                restaurant / coffee-shop owners doing a daily till check.
 */
export function getSalesSummaryHtml(
    payload: SalesSummaryPayload,
    template: SalesSummaryTemplate = 'default',
): string {
  const { restaurant, startDate, endDate, groups, cashierName } = payload;
    const L = LABELS[template];
    const isKhmer = template === 'khmer';

    const paperWidth = restaurant.receipt_width === '58mm' ? '58mm' : '80mm';
    const isSmall = paperWidth === '58mm';
    const sidePadding = isSmall ? '2mm' : '4mm';
    const cutterFeed  = isSmall ? '4mm' : '6mm';

    const totalOrders     = groups.length;
    const totalUsd        = groups.reduce((s, g) => s + g.total_usd, 0);
    const totalKhr        = groups.reduce((s, g) => s + g.total_khr, 0);
    const totalVat        = groups.reduce((s, g) => s + g.total_vat, 0);
    const totalPlt        = groups.reduce((s, g) => s + g.total_plt, 0);
    const subtotalUsd     = totalUsd - totalVat - totalPlt;
    const adjustments     = (payload.adjustments || []).filter(a => a.info.trim() && a.price_cents > 0);
    const adjustmentTotalUsd = adjustments.reduce((s, a) => s + a.price_cents, 0);
    const netCashUsd      = Math.max(totalUsd - adjustmentTotalUsd, 0);

    const completed       = groups.filter(g => g.status === 'completed');
    const completedRevenueUsd = completed.reduce((s, g) => s + g.total_usd, 0);

    const avgTicketUsd    = totalOrders > 0 ? Math.round(totalUsd / totalOrders) : 0;

    const rangeStr        = rangeLabel(startDate, endDate);
    const generatedStr    = format(new Date(), 'dd MMM yyyy HH:mm');
    const topItems        = payload.topItems || [];

    // ── Per-order rows (sorted oldest → newest for till reconciliation) ─
    const sorted = [...groups].sort((a, b) =>
        parseSqliteTs(a.created_at).getTime() - parseSqliteTs(b.created_at).getTime()
    );
    const orderRows = sorted.map(g => {
      const createdAt = parseSqliteTs(g.created_at);
      const t = formatSafe(createdAt, 'HH:mm', '--:--');
        const ref = g.id.split('-')[0].slice(0, 6).toUpperCase();
        const tbl = g.table_id ? escapeHtml(g.table_id) : L.takeoutShort;
        const amt = formatUsd(g.total_usd);
        const isOpen = g.status === 'open';
        const isHold = g.status === 'hold' || g.status === 'pending_payment';
        const marker = isOpen ? '·O' : isHold ? '·H' : '';
        return `<tr>
          <td class="ord-t">${t}</td>
          <td class="ord-r">${ref}${marker}</td>
          <td class="ord-tbl">${tbl}</td>
          <td class="ord-amt">${amt}</td>
        </tr>`;
    }).join('');

    const adjustmentRows = adjustments.map((row) => {
        const rowDate = row.date ? formatSafe(parseSqliteTs(`${row.date} 00:00:00`), isKhmer ? 'dd/MM' : 'dd MMM', row.date) : '--';
        return `<tr>
          <td class="adj-date">${escapeHtml(rowDate)}</td>
          <td class="adj-info">${escapeHtml(row.info)}</td>
          <td class="adj-amt">${formatUsd(row.price_cents)}</td>
        </tr>`;
    }).join('');

    // ── Header: Khmer template puts the Khmer business name first & larger ──
    const headerHtml = isKhmer
        ? `
        ${restaurant.khmer_name ? `<div class="biz-km-primary">${escapeHtml(restaurant.khmer_name)}</div>` : ''}
        <div class="biz-name-secondary">${escapeHtml(restaurant.name)}</div>
        ${restaurant.address ? `<div class="addr">${escapeHtml(restaurant.address)}</div>` : ''}
        <div class="doc-type doc-type-km">${L.docType}</div>
        `
        : `
        <div class="biz-name">${escapeHtml(restaurant.name)}</div>
        ${restaurant.khmer_name ? `<div class="biz-km">${escapeHtml(restaurant.khmer_name)}</div>` : ''}
        ${restaurant.address ? `<div class="addr">${escapeHtml(restaurant.address)}</div>` : ''}
        <div class="doc-type">${L.docType}</div>
        `;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${L.docType}</title>
  <style>
    @page { size: ${paperWidth} auto; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body {
      font-family: 'Inter', 'Khmer OS', 'Khmer OS Battambang', 'Noto Sans Khmer', system-ui, sans-serif;
      font-size: ${isSmall ? '10px' : '11.5px'};
      color: #000;
      padding: 0 ${sidePadding} ${cutterFeed};
    }

    /* ── Header ── */
    .hd { text-align: center; padding-top: 2mm; padding-bottom: 6px; }
    .hd .biz-name { font-size: ${isSmall ? '15px' : '18px'}; font-weight: 900; text-transform: uppercase; margin-bottom: 2px; }
    .hd .biz-km   { font-size: ${isSmall ? '13px' : '16px'}; font-weight: 700; margin-bottom: 4px; }
    .hd .biz-km-primary {
      font-size: ${isSmall ? '17px' : '21px'};
      font-weight: 900;
      line-height: 1.15;
      margin-bottom: 2px;
    }
    .hd .biz-name-secondary {
      font-size: ${isSmall ? '11px' : '13px'};
      font-weight: 700;
      opacity: 0.85;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 4px;
    }
    .hd .addr { font-size: ${isSmall ? '8.5px' : '10px'}; line-height: 1.35; }
    .doc-type {
      display: inline-block;
      margin-top: 6px;
      padding: 3px ${isSmall ? '8px' : '12px'};
      border: 1.5px solid #000;
      font-size: ${isSmall ? '10px' : '12px'};
      font-weight: 900;
      letter-spacing: ${isSmall ? '1px' : '2px'};
      text-transform: uppercase;
    }
    .doc-type-km {
      letter-spacing: 0;
      text-transform: none;
      font-size: ${isSmall ? '11px' : '13px'};
      padding: 4px ${isSmall ? '10px' : '14px'};
      border-width: 2px;
    }

    /* ── Dividers ── */
    .d-dash   { border: none; border-top: 1px dashed #000; margin: 6px 0; }
    .d-double { border: none; border-top: 3px double #000; margin: 6px 0; }

    /* ── Meta block ── */
    .meta { font-size: ${isSmall ? '9px' : '10.5px'}; width: 100%; border-collapse: collapse; margin-bottom: 4px; }
    .meta td  { padding: 1px 0; }
    .meta .lbl { font-weight: 700; opacity: 0.75; ${isKhmer ? '' : 'text-transform: uppercase;'} font-size: ${isSmall ? '7.5px' : '9px'}; }
    .meta .val { font-weight: 900; }
    .right { text-align: right; }

    /* ── Section headers ── */
    .section-hd {
      font-size: ${isSmall ? '8px' : '9.5px'};
      font-weight: 900;
      letter-spacing: 1px;
      ${isKhmer ? '' : 'text-transform: uppercase;'}
      margin: 6px 0 2px;
      opacity: 0.75;
      ${isKhmer ? `font-size: ${isSmall ? '11px' : '12.5px'}; text-align: center; letter-spacing: 0; opacity: 0.9;` : ''}
    }

    /* ── Order list ── */
    .ord-tbl-w { width: 100%; border-collapse: collapse; margin-top: 2px; }
    .ord-tbl-w th {
      text-align: left;
      font-size: ${isSmall ? '7.5px' : '8.5px'};
      font-weight: 900;
      padding-bottom: 3px;
      border-bottom: 1px solid #000;
      ${isKhmer ? '' : 'text-transform: uppercase;'}
      opacity: 0.7;
    }
    .ord-tbl-w td { padding: 2.5px 0; vertical-align: top; border-bottom: 1px dotted #ccc; font-size: ${isSmall ? '9px' : '10.5px'}; }
    .ord-t   { width: ${isSmall ? '32px' : '38px'}; font-family: monospace; }
    .ord-r   { width: ${isSmall ? '52px' : '62px'}; font-weight: 700; font-family: monospace; }
    .ord-tbl { font-weight: 700; }
    .ord-amt { text-align: right; font-weight: 900; font-family: monospace; }

    /* Adjustment rows */
    .adj-tbl-w { width: 100%; border-collapse: collapse; margin-top: 2px; }
    .adj-tbl-w th {
      text-align: left;
      font-size: ${isSmall ? '7.5px' : '8.5px'};
      font-weight: 900;
      padding-bottom: 3px;
      border-bottom: 1px solid #000;
      ${isKhmer ? '' : 'text-transform: uppercase;'}
      opacity: 0.7;
    }
    .adj-tbl-w td { padding: 2.5px 0; vertical-align: top; border-bottom: 1px dotted #ccc; font-size: ${isSmall ? '9px' : '10.5px'}; }
    .adj-date { width: ${isSmall ? '42px' : '48px'}; font-family: monospace; }
    .adj-info { font-weight: 700; word-break: break-word; }
    .adj-amt { text-align: right; font-weight: 900; font-family: monospace; width: ${isSmall ? '56px' : '66px'}; }

    /* Top-items columns */
    .top-rank { width: 18px; text-align: center; font-weight: 900; font-family: monospace; }
    .top-name { font-weight: 700; word-break: break-word; }
    .top-qty  { width: ${isSmall ? '32px' : '40px'}; text-align: center; font-weight: 900; font-family: monospace; }

    /* ── Totals ── */
    .totals { width: 100%; border-collapse: collapse; margin-top: 8px; }
    .totals td   { padding: 2px 0; }
    .totals .lbl { font-weight: 700; }
    .totals .v   { text-align: right; font-weight: 700; font-family: monospace; }
    .grand-usd { font-size: ${isSmall ? '14px' : '17px'}; font-weight: 900; padding: 6px 0 2px; border-top: 1px dashed #000; }
    .grand-khr { font-size: ${isSmall ? '10.5px' : '12.5px'}; font-weight: 900; }

    .footer { text-align: center; margin-top: 8px; border-top: 1px dashed #000; padding-top: 6px; }
    .footer .msg { font-size: ${isSmall ? '10px' : '11px'}; font-weight: 700; }
    .footer .brand { font-size: ${isSmall ? '7px' : '8.5px'}; opacity: 0.4; text-transform: uppercase; margin-top: 4px; }

    .legend { font-size: ${isSmall ? '7.5px' : '8.5px'}; opacity: 0.55; margin-top: 4px; text-align: center; }
  </style>
</head>
<body>
  <div class="hd">${headerHtml}</div>

  <div class="d-dash"></div>

  <table class="meta">
    <tr>
      <td><span class="lbl">${L.period}</span></td>
      <td class="right"><span class="val">${escapeHtml(rangeStr)}</span></td>
    </tr>
    <tr>
      <td><span class="lbl">${L.generated}</span></td>
      <td class="right"><span class="val">${escapeHtml(generatedStr)}</span></td>
    </tr>
    ${cashierName ? `<tr>
      <td><span class="lbl">${L.operator}</span></td>
      <td class="right"><span class="val">${escapeHtml(cashierName)}</span></td>
    </tr>` : ''}
  </table>

  <div class="d-double"></div>

  ${topItems.length > 0 ? `
  <div class="section-hd">${L.topItemsHeader}</div>
  <table class="ord-tbl-w">
    <thead>
      <tr>
        <th class="top-rank">#</th>
        <th>${L.colName}</th>
        <th class="top-qty">${L.colQty}</th>
        <th class="ord-amt">${L.colRevenue}</th>
      </tr>
    </thead>
    <tbody>
      ${topItems.map((p, i) => `<tr>
        <td class="top-rank">${i + 1}</td>
        <td class="top-name">${escapeHtml(p.name || '—')}</td>
        <td class="top-qty">${p.order_count}</td>
        <td class="ord-amt">${formatUsd(p.total_revenue)}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  ` : ''}

  ${adjustmentRows ? `
  <div class="section-hd">${L.adjustmentsHeader}</div>
  <table class="adj-tbl-w">
    <thead>
      <tr>
        <th class="adj-date">${L.adjDate}</th>
        <th class="adj-info">${L.adjInfo}</th>
        <th class="adj-amt">${L.adjPrice}</th>
      </tr>
    </thead>
    <tbody>
      ${adjustmentRows || ''}
    </tbody>
  </table>
  ` : ''}

  ${totalOrders > 0 ? `
  <div class="section-hd">${L.ordersHeader}</div>
  <table class="ord-tbl-w">
    <thead>
      <tr>
        <th class="ord-t">${L.colTime}</th>
        <th class="ord-r">${L.colRef}</th>
        <th class="ord-tbl">${L.colTbl}</th>
        <th class="ord-amt">${L.colTotal}</th>
      </tr>
    </thead>
    <tbody>
      ${orderRows}
    </tbody>
  </table>
  <div class="legend">${L.legend}</div>
  ` : `<div class="section-hd" style="text-align:center;opacity:0.5;">${L.noTransactions}</div>`}

  <table class="totals">
    ${subtotalUsd !== totalUsd ? `
    <tr><td class="lbl">${L.subtotal}</td><td class="v">${formatUsd(subtotalUsd)}</td></tr>
    ${totalVat ? `<tr><td class="lbl">${L.vat}</td><td class="v">${formatUsd(totalVat)}</td></tr>` : ''}
    ${totalPlt ? `<tr><td class="lbl">${L.plt}</td><td class="v">${formatUsd(totalPlt)}</td></tr>` : ''}
    ` : ''}
    <tr>
      <td class="grand-usd">${L.grossUsd}</td>
      <td class="grand-usd right">${formatUsd(totalUsd)}</td>
    </tr>
    <tr>
      <td class="grand-khr">${L.grossKhr}</td>
      <td class="grand-khr right">${formatKhr(totalKhr)}</td>
    </tr>
    ${adjustmentTotalUsd > 0 ? `
    <tr><td class="lbl" style="padding-top:6px;">${L.adjustmentTotal}</td><td class="v" style="padding-top:6px;">-${formatUsd(adjustmentTotalUsd)}</td></tr>
    <tr><td class="lbl">${L.netCash}</td><td class="v">${formatUsd(netCashUsd)}</td></tr>
    ` : ''}
    ${completed.length !== totalOrders ? `
    <tr><td class="lbl" style="padding-top:6px;">${L.completedOnly}</td><td class="v" style="padding-top:6px;">${formatUsd(completedRevenueUsd)}</td></tr>
    ` : ''}
    ${totalOrders > 0 ? `
    <tr><td class="lbl">${L.avgOrder}</td><td class="v">${formatUsd(avgTicketUsd)}</td></tr>
    ` : ''}
  </table>

  <div class="footer">
    <div class="msg">${L.endOfReport}</div>
    <div class="brand">Powered by DineOS</div>
  </div>
</body>
</html>`;
}

/**
 * Render + dispatch — opens the slide-out preview sheet with both template
 * variants. The cashier picks "Default" or "Khmer" via the tab row in the
 * sheet; their last choice is remembered in localStorage under rememberKey.
 */
export function printSalesSummary(payload: SalesSummaryPayload) {
    if (typeof window === 'undefined') return;
    dispatchThermalPrint({
        templates: [
            { id: 'default', label: 'Default',  html: getSalesSummaryHtml(payload, 'default') },
            { id: 'khmer',   label: 'ខ្មែរ',     html: getSalesSummaryHtml(payload, 'khmer')   },
        ],
        paperWidth: payload.restaurant.receipt_width === '58mm' ? '58mm' : '80mm',
        title: 'Sales Summary',
        subtitle: rangeLabel(payload.startDate, payload.endDate),
        defaultTemplateId: 'default',
        rememberKey: 'dineos.template.summary',
    });
}

export function printDailyClosingReport(restaurant: Restaurant, detail: DailyReportDetail) {
    const report = detail.report;
    const expenses = detail.expenses || [];
  const inventoryUsage = detail.inventory_usage || [];
    const width = restaurant.receipt_width === '58mm' ? '58mm' : '80mm';
  const estimatedProfitAfterInventory = report.net_profit_usd - (detail.inventory_total_cost_usd || 0);

    const expenseRows = expenses
        .map((e) => `
        <tr>
          <td>${escapeHtml(e.category)}</td>
          <td>${escapeHtml(e.description)}</td>
          <td class="right">${formatUsd(e.amount_usd_cents)}</td>
        </tr>`)
        .join('');

    const inventoryRows = inventoryUsage
        .map((row) => `
        <tr>
          <td>${escapeHtml(row.inventory_item_name)}</td>
          <td class="right mono">${row.used_quantity.toFixed(2)} ${escapeHtml(row.unit_label)}</td>
          <td class="right">${formatUsd(row.total_cost_usd)}</td>
        </tr>`)
        .join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Daily Sales Report</title>
  <style>
    @page { size: ${width} auto; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Inter, Arial, sans-serif; background: #fff; color: #000; padding: 0 4mm 8mm; font-size: 11px; }
    .center { text-align: center; }
    .title { font-weight: 900; font-size: 13px; margin-top: 4px; }
    .sub { font-size: 10px; opacity: 0.8; }
    .line { border-top: 1px dashed #000; margin: 6px 0; }
    .section { font-weight: 900; font-size: 10px; text-transform: uppercase; margin: 5px 0 3px; }
    .grid { width: 100%; border-collapse: collapse; }
    .grid td, .grid th { padding: 2px 0; vertical-align: top; }
    .right { text-align: right; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .notes { white-space: pre-wrap; font-size: 10px; line-height: 1.35; }
    .footer { margin-top: 8px; text-align: center; font-size: 9px; }
  </style>
</head>
<body>
  <div class="center title">DineOS POS</div>
  <div class="center title">Daily Sales Report</div>
  <div class="line"></div>

  <table class="grid">
    <tr><td>Date</td><td class="right mono">${escapeHtml(report.report_date)}</td></tr>
    <tr><td>Cashier</td><td class="right">${escapeHtml(report.cashier_name || '-')}</td></tr>
  </table>

  <div class="line"></div>
  <div class="section">Sales Summary</div>
  <table class="grid">
    <tr><td>Total Orders</td><td class="right mono">${report.total_orders}</td></tr>
    <tr><td>Paid Orders</td><td class="right mono">${report.paid_orders}</td></tr>
    <tr><td>Voided Orders</td><td class="right mono">${report.voided_orders}</td></tr>
    <tr><td>Total Sales</td><td class="right mono">${formatUsd(report.total_sales_usd)}</td></tr>
  </table>

  <div class="line"></div>
  <div class="section">Expense Summary</div>
  <table class="grid">
    ${expenseRows || '<tr><td colspan="3" class="sub">No expenses</td></tr>'}
    <tr><td colspan="2"><b>Total Expenses</b></td><td class="right mono"><b>${formatUsd(report.total_expenses_usd)}</b></td></tr>
  </table>

  <div class="line"></div>
  <div class="section">Inventory Usage</div>
  <table class="grid">
    ${inventoryRows || '<tr><td colspan="3" class="sub">No linked inventory usage</td></tr>'}
    <tr><td colspan="2"><b>Total Inventory Cost</b></td><td class="right mono"><b>${formatUsd(detail.inventory_total_cost_usd || 0)}</b></td></tr>
  </table>

  <div class="line"></div>
  <div class="section">Profit Summary</div>
  <table class="grid">
    <tr><td>Total Sales</td><td class="right mono">${formatUsd(report.total_sales_usd)}</td></tr>
    <tr><td>Total Expenses</td><td class="right mono">-${formatUsd(report.total_expenses_usd)}</td></tr>
    <tr><td><b>Operational Profit</b></td><td class="right mono"><b>${formatUsd(report.net_profit_usd)}</b></td></tr>
    <tr><td>Inventory Usage Cost</td><td class="right mono">-${formatUsd(detail.inventory_total_cost_usd || 0)}</td></tr>
    <tr><td><b>Estimated Profit After Inventory</b></td><td class="right mono"><b>${formatUsd(estimatedProfitAfterInventory)}</b></td></tr>
  </table>

  <div class="line"></div>
  <div class="section">Notes</div>
  <div class="notes">${escapeHtml(report.notes || '-')}</div>

  <div class="line"></div>
  <table class="grid">
    <tr><td>Report Status</td><td class="right"><b>${escapeHtml((report.status || 'closed').toUpperCase())}</b></td></tr>
    <tr><td>Generated By</td><td class="right">${escapeHtml(report.cashier_name || '-')}</td></tr>
    <tr><td>Generated Time</td><td class="right mono">${escapeHtml(report.closed_at)}</td></tr>
  </table>

  <div class="line"></div>
  <div class="footer">DineOS</div>
</body>
</html>`;

    dispatchThermalPrint({
        templates: [{ id: 'default', label: 'Default', html }],
        paperWidth: width,
        title: 'Daily Sales Report',
        subtitle: report.report_date,
        defaultTemplateId: 'default',
        rememberKey: 'dineos.template.daily-close-report',
    });
}
