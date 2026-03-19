import { call } from './client';
import type { ExchangeRate, DbStatus } from '@/types';

export const getExchangeRate = () => call<ExchangeRate>('get_exchange_rate');

export const setExchangeRate = (rate: number) =>
    call<ExchangeRate>('set_exchange_rate', { rate });

export const getDbStatus = () => call<DbStatus>('get_db_status');
