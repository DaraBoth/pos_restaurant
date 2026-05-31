import { call } from './client';
import type { FloorTable } from '@/types';

export const getTables = (restaurantId?: string) =>
    call<FloorTable[]>('get_tables', { restaurantId });

export const createTable = (name: string, seat_count?: number, zone?: string, restaurantId?: string) =>
    call<FloorTable>('create_table', { name, seatCount: seat_count, zone, restaurantId });

export const deleteTable = (id: string, restaurant_id: string, actorUserId: string) =>
    call<void>('delete_table', { id, restaurantId: restaurant_id, actorUserId });
