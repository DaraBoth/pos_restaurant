import { call } from './client';
import type { FloorTable } from '@/types';

export const getTables = () => call<FloorTable[]>('get_tables');

export const createTable = (name: string, seat_count?: number) =>
    call<FloorTable>('create_table', { name, seatCount: seat_count });

export const deleteTable = (id: string) => call<void>('delete_table', { id });
