import { call } from './client';
import type { KitchenOrder } from '@/types';

export const getKitchenOrders = (restaurant_id?: string) =>
    call<KitchenOrder[]>('get_kitchen_orders', { restaurantId: restaurant_id });

export const updateKitchenItemStatus = (
    item_id: string,
    status: 'pending' | 'cooking' | 'done'
) => call<void>('update_kitchen_item_status', { itemId: item_id, status });
