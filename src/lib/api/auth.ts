import { call } from './client';
import type { UserSession, RestaurantSummary } from '@/types';

export const login = (username: string, password: string) =>
    call<UserSession>('login', { username, password });

/** Called after successful login to start the per-restaurant cloud sync daemon */
export const triggerSync = (restaurantId: string) =>
    call<void>('trigger_sync', { restaurantId });


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

export const superadminUpdateAdmin = (params: {
    adminId: string;
    newUsername?: string;
    newPassword?: string;
    newFullName?: string;
}) => call<void>('superadmin_update_admin', {
    adminId: params.adminId,
    newUsername: params.newUsername,
    newPassword: params.newPassword,
    newFullName: params.newFullName,
});

export const updateSuperadminProfile = (params: {
    superadminId: string;
    newUsername?: string;
    newPassword?: string;
    newFullName?: string;
}) => call<void>('update_superadmin_profile', {
    superadminId: params.superadminId,
    newUsername: params.newUsername,
    newPassword: params.newPassword,
    newFullName: params.newFullName,
});

export interface SuperadminUserView {
    id: string;
    restaurant_id: string | null;
    restaurant_name: string | null;
    username: string;
    role: string;
    full_name: string | null;
    created_at: string;
}

export const superadminGetAllUsers = () =>
    call<SuperadminUserView[]>('superadmin_get_all_users');
