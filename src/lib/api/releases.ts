import { call } from './client';

export interface AppRelease {
    id: string;
    version: string;
    release_notes?: string;
    /** "db" = stored in database, "https://..." = external URL, undefined = not available */
    windows_file?: string;
    windows_signature?: string;
    /** "db" = stored in database, "https://..." = external URL, undefined = not available */
    mac_file?: string;
    mac_signature?: string;
    created_at: string;
}

export const getAppReleases = () =>
    call<AppRelease[]>('get_app_releases');

/**
 * Downloads a release file from the database to the user's Downloads folder.
 * Returns either:
 *   - An absolute file path (file was written to Downloads directory)
 *   - A string starting with "url:" (external URL — open in browser)
 */
export const downloadReleaseFile = (id: string, platform: 'windows' | 'mac') =>
    call<string>('download_release_file', { id, platform });

export const createAppRelease = (params: {
    version: string;
    release_notes?: string;
    windows_file?: string;
    windows_signature?: string;
    mac_file?: string;
    mac_signature?: string;
}) => call<AppRelease>('create_app_release', {
    version: params.version,
    releaseNotes: params.release_notes,
    windowsFile: params.windows_file,
    windowsSignature: params.windows_signature,
    macFile: params.mac_file,
    macSignature: params.mac_signature
});

export const deleteAppRelease = (id: string) =>
    call<void>('delete_app_release', { id });
