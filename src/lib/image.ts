/**
 * Returns a usable image src from a stored image_path value.
 *
 * New uploads store a base64 data URI (data:image/jpeg;base64,...) directly
 * in the database - this works fully offline with zero file-system dependencies.
 *
 * Returns null when called server-side (Next.js SSR) or when value is empty.
 */
export function getImageSrc(filePath: string | null | undefined): string | null {
    if (!filePath || typeof window === 'undefined') return null;
    // Base64 data URI — use directly (new upload path)
    if (filePath.startsWith('data:')) return filePath;
    // Legacy: absolute file path saved by old code — try asset protocol as fallback
    const normalised = filePath.replace(/\\/g, '/');
    return `https://asset.localhost/${encodeURIComponent(normalised)}`;
}
