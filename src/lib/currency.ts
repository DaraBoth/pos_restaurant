// ============================================================
// currency.ts — Dual USD/KHR helpers with GDT/NBC rounding
// ============================================================

/**
 * GDT/NBC rounding rule:
 *   - If the KHR decimal part > 0.5 → round up to nearest riel
 *   - Otherwise → round down (truncate)
 */
export function roundKhr(usdCents: number, rate: number): number {
    const totalKhrFloat = (usdCents / 100) * rate;
    const intPart = Math.floor(totalKhrFloat);
    const frac = totalKhrFloat - intPart;
    return frac > 0.5 ? intPart + 1 : intPart;
}

/** Format USD cents to display string: e.g. 450 → "$4.50" */
export function formatUsd(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
}

/** Format KHR riels to display string: e.g. 18450 → "18,450 ៛" */
export function formatKhr(riels: number): string {
    return `${riels.toLocaleString('km-KH')} ៛`;
}

/** Format USD cents to short numeric: 450 → "4.50" */
export function formatUsdNumeric(cents: number): string {
    return (cents / 100).toFixed(2);
}

/** Parse a USD string like "4.50" to cents (450) */
export function parseToCents(usdString: string): number {
    const val = parseFloat(usdString);
    if (isNaN(val)) return 0;
    return Math.round(val * 100);
}

/** Calculate order totals including VAT + PLT */
export interface OrderTotals {
    subtotalCents: number;
    vatCents: number;        // 10% VAT
    pltCents: number;        // 3% PLT
    totalUsdCents: number;
    totalKhr: number;
}

export function calculateTotals(subtotalCents: number, exchangeRate: number): OrderTotals {
    const vatCents = Math.round(subtotalCents * 0.10);
    const pltCents = Math.round(subtotalCents * 0.03);
    const totalUsdCents = subtotalCents + vatCents + pltCents;
    const totalKhr = roundKhr(totalUsdCents, exchangeRate);
    return { subtotalCents, vatCents, pltCents, totalUsdCents, totalKhr };
}

/** Convert USD cents to KHR riels */
export function usdToKhr(usdCents: number, rate: number): number {
    return roundKhr(usdCents, rate);
}

/** Convert KHR riels to USD cents */
export function khrToUsdCents(riels: number, rate: number): number {
    return Math.round((riels / rate) * 100);
}
