import { call } from './client';
import type { Restaurant, RestaurantInput, SetupStatus } from '@/types';

export const getRestaurant = (restaurantId?: string) => call<Restaurant>('get_restaurant', { restaurantId });

export const getSetupStatus = (restaurantId?: string) => call<SetupStatus>('get_setup_status', { restaurantId });

export const updateRestaurant = (input: RestaurantInput, restaurantId?: string) =>
    call<Restaurant>('update_restaurant', { input, restaurantId });

export const saveLogo = (filename: string, content: Uint8Array) =>
    call<string>('save_logo', { filename, content: Array.from(content) });
