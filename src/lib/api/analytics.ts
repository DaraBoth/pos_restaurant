import { call } from './client';
import type { RevenueSummary, RevenueByDay, TopProduct, CategoryRevenue, PeakHour } from '@/types';

export const getRevenueSummary = () => call<RevenueSummary>('get_revenue_summary');

export const getRevenueByPeriod = (period: 'week' | 'month' | '3months' | 'year') =>
    call<RevenueByDay[]>('get_revenue_by_period', { period });

export const getTopProducts = (period: string) =>
    call<TopProduct[]>('get_top_products', { period });

export const getRevenueByCategory = (period: string) =>
    call<CategoryRevenue[]>('get_revenue_by_category', { period });

export const getPeakHours = (period: string) =>
    call<PeakHour[]>('get_peak_hours', { period });

export const getSlowMovers = () =>
    call<TopProduct[]>('get_slow_movers');
