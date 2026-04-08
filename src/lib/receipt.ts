import { OrderItem, PaymentInput, Restaurant } from '@/lib/tauri-commands';
import { formatKhr, formatUsd } from '@/lib/currency';

export interface ReceiptPrintPayload {
    restaurant: Restaurant;
    orderId: string;
    tableId?: string;
    customerName?: string;
    customerPhone?: string;
    discountPct?: number;
    discountCents?: number;
    items: OrderItem[];
    payments: PaymentInput[];
    totals: {
        subtotalCents: number;
        vatCents: number;
        pltCents: number;
        totalUsdCents: number;
        totalKhr: number;
    };
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

    const itemRows = payload.items.map((item, idx) => `
        <tr class="item-row">
            <td class="col-id">${idx + 1}</td>
            <td class="col-name">
                ${escapeHtml(item.product_name || '')}
                ${item.product_khmer ? `<div class="item-km">${escapeHtml(item.product_khmer)}</div>` : ''}
            </td>
            <td class="col-qty">${item.quantity}</td>
            <td class="col-price">${formatUsd(item.price_at_order)}</td>
            <td class="col-total">${formatUsd(item.price_at_order * item.quantity)}</td>
        </tr>
    `).join('');

    const paymentRows = payload.payments.map(payment => `
        <tr>
            <td class="pay-method">${escapeHtml(payment.method)} <span class="pay-cur">(${escapeHtml(payment.currency)})</span></td>
            <td>${payment.currency === 'KHR' ? formatKhr(payment.amount) : formatUsd(payment.amount)}</td>
        </tr>
    `).join('');

    const footerLines = (payload.restaurant.receipt_footer || 'Thank you for your visit!')
        .split('\n')
        .filter(Boolean)
        .map(line => `<div style="margin-top: 2px;">${escapeHtml(line)}</div>`)
        .join('');

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt</title>
  <style>
    @page { size: 58mm auto; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 10px;
      color: #000;
      width: 58mm;
      padding: 4mm 2mm;
    }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: 900; }

    /* ── Header ── */
    .hd { text-align: center; padding-bottom: 8px; }
    .hd .biz-name { font-size: 15px; font-weight: 900; text-transform: uppercase; margin-bottom: 2px; }
    .hd .biz-km { font-size: 13px; font-weight: 700; margin-bottom: 4px; }
    .hd .addr { font-size: 8.5px; line-height: 1.3; }

    /* ── Dividers ── */
    .d-dash { border: none; border-top: 1px dashed #000; margin: 6px 0; }
    .d-double { border: none; border-top: 3px double #000; margin: 6px 0; }

    /* ── Meta ── */
    .meta { font-size: 9px; width: 100%; border-collapse: collapse; margin-bottom: 4px; }
    .meta td { padding: 1px 0; }
    .meta .lbl { font-weight: 700; text-transform: uppercase; font-size: 7.5px; opacity: 0.8; }
    .meta .val { font-weight: 900; }

    /* ── Items ── */
    .items-tbl { width: 100%; border-collapse: collapse; margin-top: 4px; }
    .items-tbl th { 
        text-align: left; 
        font-size: 8px; 
        font-weight: 900; 
        padding-bottom: 4px;
        border-bottom: 1px solid #000;
    }
    .items-tbl td { padding: 5px 0; vertical-align: top; border-bottom: 1px solid #f0f0f0; }
    .col-qty { width: 22px; text-align: center; font-weight: 900; }
    .col-total { width: 55px; text-align: right; font-weight: 900; }
    .item-nm { font-weight: 700; display: block; }
    .item-km { font-size: 9.5px; opacity: 0.8; }
    .item-pr { font-size: 8px; opacity: 0.6; font-family: monospace; }

    /* ── Summary ── */
    .summary { margin-top: 8px; padding-top: 4px; }
    .totals { width: 100%; border-collapse: collapse; }
    .totals td { padding: 2px 0; }
    .grand-usd { font-size: 14px; font-weight: 900; padding: 6px 0 2px; border-top: 1px dashed #000; }
    .grand-khr { font-size: 10.5px; font-weight: 900; }

    .footer { text-align: center; margin-top: 15px; border-top: 1px dashed #000; padding-top: 10px; }
    .footer .msg { font-size: 10.5px; font-weight: 700; }
    .footer .brand { font-size: 7px; opacity: 0.4; text-transform: uppercase; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="hd">
    <div class="biz-name">${escapeHtml(payload.restaurant.name)}</div>
    ${payload.restaurant.khmer_name ? `<div class="biz-km">${escapeHtml(payload.restaurant.khmer_name)}</div>` : ''}
    <div class="addr">
      ${payload.restaurant.address ? escapeHtml(payload.restaurant.address) : ''}
      ${payload.restaurant.phone ? `<br>Tel: ${escapeHtml(payload.restaurant.phone)}` : ''}
    </div>
  </div>

  <div class="d-dash"></div>

  <table class="meta">
    <tr>
      <td><span class="lbl">Receipt:</span> <span class="val">#${escapeHtml(payload.orderId.slice(0, 8).toUpperCase())}</span></td>
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
  </table>

  <div class="d-double"></div>

  <table class="items-tbl">
    <thead>
      <tr>
        <th class="col-qty center">QTY</th>
        <th>DESCRIPTION</th>
        <th class="col-total right">TOTAL</th>
      </tr>
    </thead>
    <tbody>
      ${payload.items.map(item => `
        <tr>
          <td class="col-qty center">${item.quantity}</td>
          <td>
            <span class="item-nm">${escapeHtml(item.product_name || '')}</span>
            ${item.product_khmer ? `<span class="item-km">${escapeHtml(item.product_khmer)}</span>` : ''}
            <span class="item-pr">${formatUsd(item.price_at_order)}</span>
          </td>
          <td class="col-total right">${formatUsd(item.price_at_order * item.quantity)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="summary">
    <table class="totals">
      <tr>
        <td>Subtotal</td>
        <td class="right">${formatUsd(payload.totals.subtotalCents + (payload.discountCents ?? 0))}</td>
      </tr>
      ${payload.discountCents ? `
      <tr style="font-weight: 900;">
        <td>Discount${payload.discountPct ? ' (' + payload.discountPct + '%)' : ''}</td>
        <td class="right">-${formatUsd(payload.discountCents)}</td>
      </tr>` : ''}
      ${payload.totals.vatCents ? `
      <tr>
        <td>VAT (10%)</td>
        <td class="right">${formatUsd(payload.totals.vatCents)}</td>
      </tr>` : ''}
      <tr>
        <td class="grand-usd">TOTAL USD</td>
        <td class="right grand-usd">${formatUsd(payload.totals.totalUsdCents)}</td>
      </tr>
      <tr>
        <td class="grand-khr">TOTAL KHR</td>
        <td class="right grand-khr">${formatKhr(payload.totals.totalKhr)}</td>
      </tr>
    </table>
  </div>

  <div class="footer">
    <div class="msg">${escapeHtml(payload.restaurant.receipt_footer || 'Thank you for your visit!')}</div>
    <div class="brand">Powered by DineOS</div>
  </div>
</body>
</html>`;
}

export function printReceipt(payload: ReceiptPrintPayload) {
    if (typeof window === 'undefined') return;

    const html = getReceiptHtml(payload);

    // Use a hidden iframe — window.open() is blocked by Tauri's WebView.
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
