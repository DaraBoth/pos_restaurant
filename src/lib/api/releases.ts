import { call } from './client';

export interface AppRelease {
    id: string;
    version: string;
    release_notes?: string;
    windows_file?: string;
    windows_signature?: string;
    mac_file?: string;
    mac_signature?: string;
    created_at: string;
}

export const getAppReleases = () => 
    call<AppRelease[]>('get_app_releases');

export const createAppRelease = (params: {
    version: string;
    release_notes?: string;
    windows_file?: string;
    windows_signature?: string;
    mac_file?: string;
    mac_signature?: string;
}) => call<AppRelease>('create_app_release', params);

export const deleteAppRelease = (id: string) => 
    call<void>('delete_app_release', { id });
