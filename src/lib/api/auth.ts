import { call } from './client';
import type { UserSession, RestaurantSummary } from '@/types';

export const login = (username: string, password: string) =>
    call<UserSession>('login', { username, password });

export const createUser = (
    username: string, password: string, role: string,
    full_name?: string, khmer_name?: string
) => call<string>('create_user', { username, password, role, fullName: full_name, khmerName: khmer_name });

export const getUsers = () => call<UserSession[]>('get_users');

export const updateUser = (
    id: string, password: string | undefined, role: string,
    full_name?: string, khmer_name?: string
) => call<void>('update_user', { id, password, role, fullName: full_name, khmerName: khmer_name });

export const deleteUser = (id: string) => call<void>('delete_user', { id });

export const listAllRestaurants = () =>
    call<RestaurantSummary[]>('list_all_restaurants');

export const createRestaurantWithAdmin = (params: {
    restaurantName: string;
    restaurantAddress?: string;
    restaurantPhone?: string;
    adminUsername: string;
    adminPassword: string;
    adminFullName?: string;
}) => call<string>('create_restaurant_with_admin', {
    restaurantName: params.restaurantName,
    restaurantAddress: params.restaurantAddress,
    restaurantPhone: params.restaurantPhone,
    adminUsername: params.adminUsername,
    adminPassword: params.adminPassword,
    adminFullName: params.adminFullName,
});
