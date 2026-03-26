import { call } from './client';
import type { ExchangeRate, DbStatus } from '@/types';

export const getExchangeRate = (restaurant_id?: string) => 
    call<ExchangeRate>('get_exchange_rate', { restaurantId: restaurant_id });

export const setExchangeRate = (rate: number, restaurant_id?: string) =>
    call<ExchangeRate>('set_exchange_rate', { rate, restaurantId: restaurant_id });

export const getDbStatus = () => call<DbStatus>('get_db_status');

export const isRestaurantSynced = (restaurantId: string) =>
    call<boolean>('is_restaurant_synced', { restaurantId });

export const triggerSync = (restaurantId: string) =>
    call<void>('trigger_sync', { restaurantId });

export const stopSync = () =>
    call<void>('stop_sync');
