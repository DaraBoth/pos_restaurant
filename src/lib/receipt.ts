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

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;

    const logoHtml = payload.restaurant.logo_path 
        ? `<img src="https://asset.localhost/${payload.restaurant.logo_path}" style="max-width: 120px; max-height: 80px; margin-bottom: 10px; filter: grayscale(1);" />` 
        : '';

    const itemRows = payload.items.map(item => `
        <div style="margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px;">
                <span>${escapeHtml(item.product_name || '')}</span>
                <span>${formatUsd(item.price_at_order * item.quantity)}</span>
            </div>
            ${item.product_khmer ? `<div style="font-size: 12px; color: #444; margin-top: 1px;">${escapeHtml(item.product_khmer)}</div>` : ''}
            <div style="font-size: 11px; color: #666; font-family: monospace;">
                ${item.quantity} x ${formatUsd(item.price_at_order)}
            </div>
        </div>
    `).join('');

    const paymentRows = payload.payments.map(payment => `
        <div style="display: flex; justify-content: space-between; margin-top: 4px; font-size: 13px;">
            <span style="text-transform: uppercase;">${escapeHtml(payment.method)} (${escapeHtml(payment.currency)})</span>
            <span>${payment.currency === 'KHR' ? formatKhr(payment.amount) : formatUsd(payment.amount)}</span>
        </div>
    `).join('');

    const footerLines = (payload.restaurant.receipt_footer || 'Thank you for your visit!')
        .split('\n')
        .filter(Boolean)
        .map(line => `<div style="margin-top: 2px;">${escapeHtml(line)}</div>`)
        .join('');

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>Receipt ${payload.orderId}</title>
                <style>
                    @page { margin: 0; }
                    body { 
                        font-family: 'Inter', -apple-system, sans-serif; 
                        padding: 20px; 
                        width: 80mm; 
                        margin: 0 auto;
                        color: #000;
                        line-height: 1.4;
                    }
                    .center { text-align: center; }
                    .divider { border-top: 1px dashed #000; margin: 15px 0; }
                    .header { margin-bottom: 20px; }
                    .header h1 { margin: 0; font-size: 22px; font-weight: 900; letter-spacing: -0.5px; }
                    .header p { margin: 2px 0; font-size: 13px; font-weight: 600; }
                    .info { font-size: 11px; font-family: monospace; color: #333; }
                    .totals { margin-top: 10px; }
                    .totals-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
                    .grand-total { 
                        font-size: 18px; 
                        font-weight: 900; 
                        border-top: 2px solid #000; 
                        padding-top: 8px; 
                        margin-top: 8px;
                    }
                    .khr-total { font-size: 14px; font-weight: 700; color: #444; }
                    @media print {
                        body { width: 100%; padding: 10mm; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header center">
                    ${logoHtml}
                    <h1>${escapeHtml(payload.restaurant.name)}</h1>
                    ${payload.restaurant.khmer_name ? `<p style="font-size: 18px; margin-top: 4px;">${escapeHtml(payload.restaurant.khmer_name)}</p>` : ''}
                    <div style="margin-top: 10px; font-size: 11px; font-weight: bold; text-transform: uppercase;">
                        ${payload.restaurant.address ? `<div>${escapeHtml(payload.restaurant.address)}</div>` : ''}
                        ${payload.restaurant.address_kh ? `<div>${escapeHtml(payload.restaurant.address_kh)}</div>` : ''}
                        ${payload.restaurant.phone ? `<div style="margin-top: 4px;">TEL: ${escapeHtml(payload.restaurant.phone)}</div>` : ''}
                    </div>
                </div>

                <div class="divider"></div>

                <div class="info">
                    <div style="display: flex; justify-content: space-between;">
                        <span>ORDER: ${payload.orderId.slice(0, 8)}...</span>
                        <span>${new Date().toLocaleDateString()}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 2px;">
                        <span>TABLE: ${payload.tableId || 'N/A'}</span>
                        <span>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                </div>

                <div class="divider"></div>

                <div class="items">
                    ${itemRows}
                </div>

                <div class="divider" style="border-top-style: solid; border-top-width: 2px;"></div>

                <div class="totals">
                    <div class="totals-row">
                        <span>SUBTOTAL </span>
                        <span>${formatUsd(payload.totals.subtotalCents)}</span>
                    </div>
                    <div class="totals-row grand-total">
                        <span>TOTAL USD</span>
                        <span>${formatUsd(payload.totals.totalUsdCents)}</span>
                    </div>
                    <div class="totals-row khr-total">
                        <span>TOTAL KHR</span>
                        <span>${formatKhr(payload.totals.totalKhr)}</span>
                    </div>
                </div>

                <div class="divider"></div>

                <div class="payments">
                    <div style="font-size: 11px; font-weight: 900; text-transform: uppercase; margin-bottom: 6px;">Payment Details</div>
                    ${paymentRows}
                </div>

                <div class="divider"></div>

                <div class="center" style="font-size: 12px; font-weight: bold;">
                    ${footerLines}
                    <div style="margin-top: 15px; font-size: 10px; font-weight: 400; font-family: monospace;">
                        POWERED BY DINEOS
                    </div>
                </div>

                <script>
                    window.onload = function () {
                        setTimeout(() => {
                            window.print();
                            window.onafterprint = () => window.close();
                            // Fallback for browsers that don't support onafterprint or if cancelled
                            setTimeout(() => window.close(), 500);
                        }, 500);
                    };
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
}