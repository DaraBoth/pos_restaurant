import { call } from './client';
import type { RevenueSummary, RevenueByDay, TopProduct, CategoryRevenue, PeakHour } from '@/types';

export const getRevenueSummary = (restaurant_id?: string) => 
    call<RevenueSummary>('get_revenue_summary', { restaurantId: restaurant_id });

export const getRevenueByPeriod = (period: 'week' | 'month' | '3months' | 'year', restaurant_id?: string) =>
    call<RevenueByDay[]>('get_revenue_by_period', { period, restaurantId: restaurant_id });

export const getTopProducts = (period: string, restaurant_id?: string) =>
    call<TopProduct[]>('get_top_products', { period, restaurantId: restaurant_id });

export const getRevenueByCategory = (period: string, restaurant_id?: string) =>
    call<CategoryRevenue[]>('get_revenue_by_category', { period, restaurantId: restaurant_id });

export const getPeakHours = (period: string, restaurant_id?: string) =>
    call<PeakHour[]>('get_peak_hours', { period, restaurantId: restaurant_id });

export const getSlowMovers = (restaurant_id?: string) =>
    call<TopProduct[]>('get_slow_movers', { restaurantId: restaurant_id });
