import { call } from './client';
import type { RevenueSummary, RevenueByDay } from '@/types';

export const getRevenueSummary = () => call<RevenueSummary>('get_revenue_summary');

export const getRevenueByPeriod = (period: 'week' | 'month' | '3months' | 'year') =>
    call<RevenueByDay[]>('get_revenue_by_period', { period });
