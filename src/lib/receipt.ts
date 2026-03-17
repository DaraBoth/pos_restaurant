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
    if (typeof window === 'undefined') {
        return;
    }

    const printWindow = window.open('', '_blank', 'width=420,height=720');
    if (!printWindow) {
        return;
    }

    const itemRows = payload.items.map(item => `
        <tr>
            <td>${escapeHtml(item.product_name || '')}</td>
            <td style="text-align:center;">${item.quantity}</td>
            <td style="text-align:right;">${formatUsd(item.price_at_order * item.quantity)}</td>
        </tr>
    `).join('');

    const paymentRows = payload.payments.map(payment => `
        <div style="display:flex; justify-content:space-between; margin-top:4px;">
            <span>${escapeHtml(payment.method.toUpperCase())} ${escapeHtml(payment.currency)}</span>
            <span>${payment.currency === 'KHR' ? formatKhr(payment.amount) : formatUsd(payment.amount)}</span>
        </div>
    `).join('');

    const footerLines = (payload.restaurant.receipt_footer || 'Thank you for dining with us!')
        .split('\n')
        .filter(Boolean)
        .map(line => `<div>${escapeHtml(line)}</div>`)
        .join('');

    printWindow.document.write(`
        <html>
            <head>
                <title>Receipt ${escapeHtml(payload.orderId)}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 16px; color: #111; }
                    h1, h2, p { margin: 0; }
                    .center { text-align: center; }
                    .muted { color: #555; font-size: 12px; }
                    .section { margin-top: 16px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
                    td { padding: 4px 0; font-size: 13px; }
                    .totals div { display: flex; justify-content: space-between; margin-top: 4px; }
                    .divider { border-top: 1px dashed #999; margin: 12px 0; }
                </style>
            </head>
            <body>
                <div class="center">
                    <h2>${escapeHtml(payload.restaurant.name)}</h2>
                    ${payload.restaurant.khmer_name ? `<p>${escapeHtml(payload.restaurant.khmer_name)}</p>` : ''}
                    ${payload.restaurant.address ? `<p class="muted">${escapeHtml(payload.restaurant.address)}</p>` : ''}
                    ${payload.restaurant.phone ? `<p class="muted">${escapeHtml(payload.restaurant.phone)}</p>` : ''}
                </div>
                <div class="divider"></div>
                <div class="muted">Order: ${escapeHtml(payload.orderId)}</div>
                ${payload.tableId ? `<div class="muted">Table: ${escapeHtml(payload.tableId)}</div>` : ''}
                <div class="muted">Printed: ${new Date().toLocaleString()}</div>
                <div class="section">
                    <table>
                        <tbody>${itemRows}</tbody>
                    </table>
                </div>
                <div class="divider"></div>
                <div class="totals">
                    <div><span>Subtotal</span><span>${formatUsd(payload.totals.subtotalCents)}</span></div>
                    <div><span>VAT</span><span>${formatUsd(payload.totals.vatCents)}</span></div>
                    <div><span>PLT</span><span>${formatUsd(payload.totals.pltCents)}</span></div>
                    <div><strong>Total</strong><strong>${formatUsd(payload.totals.totalUsdCents)}</strong></div>
                    <div><span>KHR</span><span>${formatKhr(payload.totals.totalKhr)}</span></div>
                </div>
                <div class="divider"></div>
                <div class="section">
                    <strong>Payments</strong>
                    ${paymentRows}
                </div>
                <div class="divider"></div>
                <div class="center muted">${footerLines}</div>
                <script>
                    window.onload = function () {
                        window.print();
                        setTimeout(function () { window.close(); }, 300);
                    };
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
}