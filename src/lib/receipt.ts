import { OrderItem, PaymentInput, Restaurant } from '@/lib/tauri-commands';
import { formatKhr, formatUsd } from '@/lib/currency';

interface ReceiptPrintPayload {
    restaurant: Restaurant;
    orderId: string;
    tableId?: string;
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

export function printReceipt(payload: ReceiptPrintPayload) {
    if (typeof window === 'undefined') return;

    const logoHtml = payload.restaurant.logo_path 
        ? `<img src="${payload.restaurant.logo_path}" style="max-width: 120px; max-height: 80px; margin-bottom: 10px; filter: grayscale(1);" />` 
        : '';

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

    // Use a hidden iframe — window.open() is blocked by Tauri's WebView.
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    doc.open();
    doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt</title>
  <style>
    @page {
      size: 72mm auto;
      margin: 4mm 3mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      color: #000;
      background: #fff;
      width: 66mm;
      margin: 0 auto;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ── Header ── */
    .hd { text-align: center; padding-bottom: 6px; }
    .hd img { max-width: 70px; max-height: 50px; margin-bottom: 4px; display: block; margin-left: auto; margin-right: auto; }
    .hd .biz-name { font-size: 15px; font-weight: 900; font-family: Arial, sans-serif; letter-spacing: 0.5px; }
    .hd .biz-km   { font-size: 12px; font-weight: 700; font-family: Arial, sans-serif; margin-top: 1px; }
    .hd .addr     { font-size: 10px; margin-top: 3px; line-height: 1.5; }
    .hd .phone    { font-size: 10px; font-weight: 700; margin-top: 2px; }

    /* ── Dividers ── */
    .d-dash  { border: none; border-top: 1px dashed #555; margin: 5px 0; }
    .d-solid { border: none; border-top: 1.5px solid #000; margin: 5px 0; }
    .d-eq    { border: none; border-top: 2px solid #000; margin: 4px 0; }

    /* ── Meta ── */
    .meta { font-size: 10px; width: 100%; border-collapse: collapse; }
    .meta td { padding: 1px 0; vertical-align: top; }
    .meta td:last-child { text-align: right; }
    .meta .lbl { font-weight: 900; text-transform: uppercase; }

    /* ── Items table ── */
    .items-tbl { width: 100%; border-collapse: collapse; margin: 4px 0; font-size: 10px; }
    .items-tbl thead tr { border-bottom: 1px solid #000; }
    .items-tbl th { font-weight: 900; text-transform: uppercase; padding: 1px 2px; font-size: 9px; }
    .items-tbl td { padding: 3px 2px; vertical-align: top; }
    .items-tbl .item-row:not(:last-child) td { border-bottom: 1px dotted #ccc; }
    .col-id    { width: 8%;  text-align: center; }
    .col-name  { width: 42%; }
    .col-qty   { width: 8%;  text-align: center; }
    .col-price { width: 20%; text-align: right; }
    .col-total { width: 22%; text-align: right; font-weight: 700; }
    .item-km   { font-size: 9px; color: #555; margin-top: 1px; }

    /* ── Totals ── */
    .totals { font-size: 11px; width: 100%; border-collapse: collapse; }
    .totals td { padding: 2px 0; }
    .totals td:last-child { text-align: right; }
    .totals .row-sub  { color: #444; font-size: 10px; }
    .totals .row-grand td { font-size: 14px; font-weight: 900; padding: 4px 0 2px; }
    .totals .row-khr  td { font-size: 11px; font-weight: 700; color: #222; }

    /* ── Payments ── */
    .pay-hd  { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; color: #555; margin-bottom: 3px; }
    .pay-tbl { width: 100%; border-collapse: collapse; font-size: 10px; }
    .pay-tbl td { padding: 1px 0; }
    .pay-tbl td:last-child { text-align: right; font-weight: 700; }
    .pay-method { font-weight: 700; text-transform: uppercase; }
    .pay-cur    { font-weight: 400; text-transform: none; color: #666; }

    /* ── Footer ── */
    .footer { text-align: center; padding-top: 4px; }
    .footer .msg   { font-size: 11px; font-weight: 700; line-height: 1.6; font-family: Arial, sans-serif; }
    .footer .brand { font-size: 8px; color: #aaa; letter-spacing: 0.15em; text-transform: uppercase; margin-top: 6px; }

    @media screen {
      body { width: 300px; padding: 12px; box-shadow: 0 2px 20px rgba(0,0,0,.15); border: 1px solid #e5e5e5; }
    }
  </style>
</head>
<body>

  <!-- HEADER -->
  <div class="hd">
    ${logoHtml}
    <div class="biz-name">${escapeHtml(payload.restaurant.name)}</div>
    ${payload.restaurant.khmer_name ? `<div class="biz-km">${escapeHtml(payload.restaurant.khmer_name)}</div>` : ''}
    ${payload.restaurant.address || payload.restaurant.address_kh ? `
    <div class="addr">
      ${payload.restaurant.address ? escapeHtml(payload.restaurant.address) + '<br>' : ''}
      ${payload.restaurant.address_kh ? escapeHtml(payload.restaurant.address_kh) : ''}
    </div>` : ''}
    ${payload.restaurant.phone ? `<div class="phone">TEL: ${escapeHtml(payload.restaurant.phone)}</div>` : ''}
  </div>

  <hr class="d-dash">

  <!-- ORDER META -->
  <table class="meta">
    <tr>
      <td><span class="lbl">Order</span> #${escapeHtml(payload.orderId.slice(0, 8).toUpperCase())}</td>
      <td>${escapeHtml(dateStr)}</td>
    </tr>
    <tr>
      <td><span class="lbl">Table</span> ${escapeHtml(payload.tableId || '—')}</td>
      <td>${escapeHtml(timeStr)}</td>
    </tr>
  </table>

  <hr class="d-dash">

  <!-- ITEMS TABLE -->
  <table class="items-tbl">
    <thead>
      <tr>
        <th class="col-id">#</th>
        <th class="col-name">Name</th>
        <th class="col-qty">Qty</th>
        <th class="col-price">Price</th>
        <th class="col-total">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <hr class="d-eq">

  <!-- TOTALS -->
  <table class="totals">
    <tr class="row-sub">
      <td>Subtotal</td>
      <td>${formatUsd(payload.totals.subtotalCents)}</td>
    </tr>
    <tr class="row-grand">
      <td>TOTAL USD</td>
      <td>${formatUsd(payload.totals.totalUsdCents)}</td>
    </tr>
    <tr class="row-khr">
      <td>TOTAL KHR</td>
      <td>${formatKhr(payload.totals.totalKhr)}</td>
    </tr>
  </table>

  <hr class="d-dash">

  <!-- PAYMENTS -->
  <div class="pay-hd">Payment</div>
  <table class="pay-tbl">
    ${paymentRows}
  </table>

  <hr class="d-dash">

  <!-- FOOTER -->
  <div class="footer">
    <div class="msg">${footerLines}</div>
    <div class="brand">Powered by DineOS</div>
  </div>

</body>
</html>`);

  <hr class="d-dash">

  <!-- PAYMENTS -->
  <div class="pay-title">Payment</div>
  ${paymentRows}

  <hr class="d-dash">

  <!-- FOOTER -->
  <div class="footer">
    <div class="msg">${footerLines}</div>
    <div class="brand">Powered by DineOS</div>
  </div>

</body>
</html>`);
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
