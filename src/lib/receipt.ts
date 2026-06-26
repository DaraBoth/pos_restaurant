import { OrderItem, PaymentInput, Restaurant } from '@/lib/tauri-commands';
import { formatKhr, formatUsd } from '@/lib/currency';

export interface ReceiptPrintPayload {
    restaurant: Restaurant;
    orderId: string;
    receiptNumber?: string;
    tableId?: string;
    customerName?: string;
    customerPhone?: string;
    cashierName?: string;
    receivedCents?: number;
    changeCents?: number;
    changeKhr?: number;
    receivedKhr?: number;
    discountPct?: number;
    discountCents?: number;
    // USD→KHR rate captured at checkout; shown on reprints so KHR is verifiable/stable.
    exchangeRateUsed?: number;
    takeoutCounter?: number;
    items: OrderItem[];
    payments: PaymentInput[];
    totals: {
        subtotalCents: number;
        vatCents: number;
        pltCents: number;
        totalUsdCents: number;
        totalKhr: number;
    };
    orderNotes?: string;
    isCopy?: boolean;
}

function truncateName(name: string, maxLen: number): string {
    return name.length > maxLen ? name.slice(0, maxLen - 1) + '…' : name;
}

function fmtReceiptUsd(cents: number): string {
    const negative = cents < 0;
    const abs = Math.abs(cents);
    const dollars = (abs / 100).toFixed(2);
    return (negative ? '-$' : '$') + dollars;
}

function escapeHtml(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function getReceiptHtml(payload: ReceiptPrintPayload): string {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const paperWidth = payload.restaurant.receipt_width === '58mm' ? '58mm' : '80mm';
    const isSmall = paperWidth === '58mm';
    // Side padding keeps content off the roll edge; bottom padding feeds paper
    // past the cutter head so the auto-cut doesn't slice the last printed line.
    const sidePadding = isSmall ? '2mm' : '4mm';
    const cutterFeed  = isSmall ? '2mm' : '3mm';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt</title>
  <style>
    /* size: <width> auto → page width fixed to roll, height shrinks to content. */
    @page { size: ${paperWidth} auto; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      font-size: ${isSmall ? '10px' : '11.5px'};
      color: #000;
      /* No top padding — start printing flush with the paper top.
         Bottom padding doubles as cutter clearance. */
      padding: 0 ${sidePadding} ${cutterFeed};
    }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: 900; }

    /* ── Header ── */
    .hd { text-align: center; padding-top: 2mm; padding-bottom: 6px; }
    .hd .biz-name { font-size: ${isSmall ? '15px' : '18px'}; font-weight: 900; margin-bottom: 2px; }
    .hd .biz-km { font-size: ${isSmall ? '13px' : '16px'}; font-weight: 700; margin-bottom: 4px; }
    .hd .addr { font-size: ${isSmall ? '8.5px' : '10px'}; line-height: 1.35; }

    /* ── Dividers ── */
    .d-dash { border: none; border-top: 1px dashed #000; margin: 6px 0; }
    .d-double { border: none; border-top: 3px double #000; margin: 6px 0; }

    /* ── Meta ── */
    .meta { font-size: ${isSmall ? '9px' : '10.5px'}; width: 100%; border-collapse: collapse; margin-bottom: 4px; }
    .meta td { padding: 1px 0; }
    .meta .lbl { font-weight: 700; text-transform: uppercase; font-size: ${isSmall ? '7.5px' : '9px'}; opacity: 0.8; }
    .meta .val { font-weight: 900; }

    /* ── Items ── */
    .items-tbl { width: 100%; border-collapse: collapse; margin-top: 4px; font-family: "Courier New", "Lucida Console", monospace; }
    .items-tbl th {
        text-align: left;
        font-size: ${isSmall ? '8px' : '9.5px'};
        font-weight: 900;
        padding-bottom: 4px;
        border-bottom: 1px solid #000;
    }
    .items-tbl td { padding: 5px 0; vertical-align: top; border-bottom: 1px solid #f0f0f0; }
    .col-qty { width: 22px; text-align: center; font-weight: 900; }
    .col-total { width: ${isSmall ? '55px' : '75px'}; text-align: right; font-weight: 900; font-variant-numeric: tabular-nums; }
    .item-nm { font-weight: 700; display: block; font-family: 'Inter', system-ui, sans-serif; }
    .item-km { font-size: ${isSmall ? '9.5px' : '11px'}; opacity: 0.8; font-family: 'Inter', system-ui, sans-serif; }
    .item-pr { font-size: ${isSmall ? '8px' : '9.5px'}; opacity: 0.6; font-family: "Courier New", "Lucida Console", monospace; }

    /* ── Summary ── */
    .summary { margin-top: 8px; padding-top: 4px; }
    .totals { width: 100%; border-collapse: collapse; }
    .totals td { padding: 2px 0; }
    .grand-usd { font-size: ${isSmall ? '14px' : '17px'}; font-weight: 900; padding: 6px 0 2px; border-top: 1px dashed #000; font-variant-numeric: tabular-nums; }
    .grand-khr { font-size: ${isSmall ? '10.5px' : '12.5px'}; font-weight: 900; font-variant-numeric: tabular-nums; }

    .footer { text-align: center; margin-top: 4px; border-top: 1px dashed #000; padding-top: 4px; }
    .footer .msg { font-size: ${isSmall ? '10.5px' : '12px'}; font-weight: 700; }
    .footer .brand { font-size: ${isSmall ? '7px' : '8.5px'}; opacity: 0.4; text-transform: uppercase; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="hd">
    <div class="biz-name">${escapeHtml(truncateName(payload.restaurant.name, isSmall ? 20 : 28))}</div>
    ${payload.restaurant.khmer_name ? `<div class="biz-km">${escapeHtml(truncateName(payload.restaurant.khmer_name, isSmall ? 20 : 28))}</div>` : ''}
    <div class="addr">
      ${payload.restaurant.address ? escapeHtml(payload.restaurant.address) : ''}
      ${payload.restaurant.phone ? `<br>Tel: ${escapeHtml(payload.restaurant.phone)}` : ''}
    </div>
  </div>

  <div class="d-dash"></div>

  <table class="meta">
    <tr>
      <td><span class="lbl">Receipt:</span> <span class="val">#${escapeHtml(payload.receiptNumber ?? '-')}</span></td>
      <td class="right"><span class="val">${escapeHtml(dateStr)}</span></td>
    </tr>
    ${payload.tableId ? `
    <tr>
      <td><span class="lbl">Table:</span> <span class="val">${escapeHtml(payload.tableId)}</span></td>
      <td class="right"><span class="val">${escapeHtml(timeStr)}</span></td>
    </tr>` : `
    <tr>
      <td colspan="2"><span class="lbl">Time:</span> <span class="val">${escapeHtml(timeStr)}</span></td>
    </tr>`}
    ${payload.customerName ? `
    <tr>
      <td colspan="2"><span class="lbl">Customer:</span> <span class="val">${escapeHtml(payload.customerName)}</span></td>
    </tr>` : ''}
    ${payload.takeoutCounter != null ? `
    <tr>
      <td colspan="2" style="font-weight:900;font-size:${payload.restaurant.receipt_width === '58mm' ? '13px' : '15px'};"><span class="lbl">Queue:</span> <span class="val" style="color:#000;">#${payload.takeoutCounter}</span></td>
    </tr>` : ''}
  </table>

  <div class="d-double"></div>

  <table class="items-tbl">
    <thead>
      <tr>
        <th class="col-qty center">Qty</th>
        <th>Description</th>
        <th class="col-total right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${payload.items.map(item => `
        <tr>
          <td class="col-qty center">${item.quantity}</td>
          <td>
            <span class="item-nm">${escapeHtml(truncateName(item.product_name || '', isSmall ? 14 : 22))}</span>
            ${item.product_khmer ? `<span class="item-km">${escapeHtml(truncateName(item.product_khmer, isSmall ? 12 : 20))}</span>` : ''}
            <span class="item-pr">${fmtReceiptUsd(item.price_at_order)}</span>
          </td>
          <td class="col-total right">${fmtReceiptUsd(item.price_at_order * item.quantity)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  ${payload.orderNotes ? `<div style="margin:4px 0;padding:4px 0;border-top:1px dashed #000;"><p style="font-size:${isSmall ? '9px' : '10px'};font-weight:700;opacity:0.8;">Note: ${escapeHtml(payload.orderNotes)}</p></div>` : ''}

  <div class="summary">
    <table class="totals">
      <tr>
        <td>Subtotal</td>
        <td class="right">${fmtReceiptUsd(payload.totals.subtotalCents + (payload.discountCents ?? 0))}</td>
      </tr>
      ${payload.discountCents ? `
      <tr style="font-weight: 900;">
        <td>Discount${payload.discountPct ? ' (' + payload.discountPct + '%)' : ''}</td>
        <td class="right">-${fmtReceiptUsd(payload.discountCents)}</td>
      </tr>` : ''}
      ${payload.totals.vatCents ? `
      <tr>
        <td>VAT (10%)</td>
        <td class="right">${fmtReceiptUsd(payload.totals.vatCents)}</td>
      </tr>` : ''}
      <tr>
        <td class="grand-usd">Total (USD)</td>
        <td class="right grand-usd">${fmtReceiptUsd(payload.totals.totalUsdCents)}</td>
      </tr>
      <tr>
        <td class="grand-khr">Total (KHR)</td>
        <td class="right grand-khr">${formatKhr(payload.totals.totalKhr)}</td>
      </tr>
      ${payload.exchangeRateUsed && payload.exchangeRateUsed > 0 ? `
      <tr>
        <td style="font-size:${isSmall ? '8px' : '9.5px'};opacity:0.6;">Rate used</td>
        <td class="right" style="font-size:${isSmall ? '8px' : '9.5px'};opacity:0.6;font-family:monospace;">1 USD = ${payload.exchangeRateUsed.toLocaleString()} ៛</td>
      </tr>` : ''}
    </table>
  </div>

  <div class="footer">
    ${payload.payments && payload.payments.length > 0 ? payload.payments.map(p => `<div style="font-size:${isSmall ? '10px' : '11px'};margin-bottom:2px;">${p.method === 'cash' ? 'Cash' : p.method === 'khqr' ? 'KHQR' : 'Card'} (${p.currency}): ${p.currency === 'KHR' ? escapeHtml(formatKhr(p.amount)) : escapeHtml(fmtReceiptUsd(p.amount))}</div>`).join('') : ''}
    ${(payload.receivedCents ?? 0) > 0 ? `<div style="font-size:${isSmall ? '10px' : '11px'};font-weight:700;margin-bottom:2px;">Paid: ${escapeHtml(fmtReceiptUsd(payload.receivedCents!))}</div>` : ''}
    ${(payload.receivedKhr ?? 0) > 0 ? `<div style="font-size:${isSmall ? '10px' : '11px'};font-weight:700;margin-bottom:2px;">Paid: ${escapeHtml(formatKhr(payload.receivedKhr!))}</div>` : ''}
    ${(payload.changeCents ?? 0) > 0 ? `<div style="font-size:${isSmall ? '10px' : '11px'};font-weight:900;margin-bottom:2px;">Change: ${escapeHtml(fmtReceiptUsd(payload.changeCents!))}${payload.changeKhr ? ` / ${escapeHtml(formatKhr(payload.changeKhr))}` : ''}</div>` : ''}
    ${(payload.changeKhr ?? 0) > 0 && !((payload.changeCents ?? 0) > 0) ? `<div style="font-size:${isSmall ? '10px' : '11px'};font-weight:900;margin-bottom:2px;">Change: ${escapeHtml(formatKhr(payload.changeKhr!))}</div>` : ''}
    ${payload.cashierName ? `<div style="font-size:${isSmall ? '9px' : '10px'};opacity:0.7;margin-bottom:3px;">Cashier: ${escapeHtml(payload.cashierName)}</div>` : ''}
    <div class="line" style="margin:4px 0;"></div>
    <div class="msg">${escapeHtml(payload.restaurant.receipt_footer || 'Thank you! / អរគុណ!')}</div>
    ${payload.restaurant.receipt_footer_khmer ? `<div class="msg" style="font-size:${isSmall ? '12px' : '14px'};margin-top:2px;">${escapeHtml(payload.restaurant.receipt_footer_khmer)}</div>` : ''}
    <div class="brand">DineOS</div>
  </div>
  ${payload.isCopy ? `<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:${isSmall ? '36px' : '48px'};font-weight:900;color:rgba(0,0,0,0.13);pointer-events:none;white-space:nowrap;z-index:9999;user-select:none;letter-spacing:0.05em;">COPY / ចំលង</div>` : ''}
</body>
</html>`;
}

/**
 * One renderable template inside a print job. The cashier picks one from the
 * tab row in the slide sheet when a job carries more than one option.
 */
export interface ThermalPrintTemplate {
    id: string;          // stable key, persisted in localStorage so the last choice sticks
    label: string;       // shown in the tab row (e.g. "Default", "ខ្មែរ")
    html: string;        // pre-rendered template HTML
}

/**
 * Generic thermal-print job consumed by the global ReceiptPrintSheet.
 * Any feature that wants to print to the thermal printer (order receipt,
 * sales summary, kitchen ticket…) renders its own HTML and dispatches one
 * of these — the sheet stays purely presentational.
 */
export interface ThermalPrintJob {
    templates: ThermalPrintTemplate[];
    paperWidth: '58mm' | '80mm';
    title: string;            // header line in the sheet (e.g. "Receipt", "Sales Summary")
    subtitle?: string;        // small line under the title (e.g. "#A1B2C3D4", date range)
    defaultTemplateId?: string; // fallback if the user has no remembered choice
    /**
     * localStorage key used to remember which template the cashier picked
     * across sessions. Two different doc kinds (receipt / summary) use
     * different keys so they don't share state.
     */
    rememberKey?: string;
}

export const THERMAL_PRINT_EVENT = 'dineos:thermal-print';

/** Low-level dispatcher — any new print kind (kitchen ticket, void slip, …) calls this. */
export function dispatchThermalPrint(job: ThermalPrintJob) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent<ThermalPrintJob>(THERMAL_PRINT_EVENT, { detail: job }));
}

/**
 * Default print entry point for order receipts — opens the slide-out preview
 * sheet, where the cashier confirms and then triggers the OS print dialog
 * (which lists USB / LAN / Bluetooth thermal printers configured in the OS).
 *
 * Wiring: <ReceiptPrintSheet /> is mounted once in src/app/layout.tsx and
 * listens for THERMAL_PRINT_EVENT on the window.
 */
export function printReceipt(payload: ReceiptPrintPayload) {
    if (typeof window === 'undefined') return;
    dispatchThermalPrint({
        templates: [
            { id: 'default', label: 'Default', html: getReceiptHtml(payload) },
        ],
        paperWidth: payload.restaurant.receipt_width === '58mm' ? '58mm' : '80mm',
        title: 'Receipt',
        subtitle: `#${payload.receiptNumber ?? '-'}`,
        rememberKey: 'dineos.template.receipt',
    });
}

/**
 * Direct, no-preview print — drops the receipt HTML into a hidden iframe and
 * fires window.print() immediately. Kept for flows that have already shown a
 * confirmation (e.g. future kitchen ticket auto-print). Prefer printReceipt()
 * for cashier-facing checkouts so the user sees what they're about to print.
 */
export function printReceiptDirect(payload: ReceiptPrintPayload) {
    if (typeof window === 'undefined') return;

    const html = getReceiptHtml(payload);

    // window.open() is blocked by Tauri's WebView, so we hide an iframe instead.
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }

    doc.open();
    doc.write(html);
    doc.close();

    iframe.onload = () => {
        setTimeout(() => {
            iframe.contentWindow?.print();
            setTimeout(() => {
                if (document.body.contains(iframe)) document.body.removeChild(iframe);
            }, 1000);
        }, 300);
    };
}
