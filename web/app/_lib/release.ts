// ─── Server-only — DO NOT import from a Client Component ─────────────────
// Reads `process.env.GIT_TOKEN` (set in Vercel project settings) and uses it
// as the GitHub API bearer. The token is never sent to the browser because
// the only thing that lands in the client bundle is the resolved download
// URLs (which are public GitHub asset redirects anyway).
//
// We don't import the `server-only` package to avoid adding a dep — instead,
// the runtime check below throws loudly if this module is ever bundled to
// the browser.
// ─────────────────────────────────────────────────────────────────────────

if (typeof window !== 'undefined') {
    throw new Error(
        '_lib/release.ts is server-only. Do not import it from a Client Component.',
    );
}

const REPO = 'DaraBoth/pos_restaurant';
const ENDPOINT = `https://api.github.com/repos/${REPO}/releases/latest`;

export interface GithubAsset {
    name: string;
    browser_download_url: string;
    size: number;
    content_type: string;
}

export interface GithubRelease {
    tag_name: string;
    name: string;
    published_at: string;
    body: string;
    html_url: string;
    assets: GithubAsset[];
}

/**
 * Fetch the latest release from GitHub.
 *
 * - Uses `GIT_TOKEN` when present (5000 req/hr authenticated quota) and falls
 *   back to anonymous (60 req/hr per IP) if not set.
 * - Cached on Vercel's edge for 10 minutes via `next: { revalidate: 600 }`.
 *   A new desktop release shows up here within the next 10 minutes of CI
 *   publishing it; no manual rebuild needed.
 * - Returns `null` on any fetch / parse / HTTP error so the page can render
 *   a graceful error state instead of crashing.
 */
export async function fetchLatestRelease(): Promise<GithubRelease | null> {
    const token = process.env.GIT_TOKEN;

    const headers: HeadersInit = {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    };
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    try {
        const res = await fetch(ENDPOINT, {
            headers,
            next: { revalidate: 600 },
        });
        if (!res.ok) {
            console.warn(`[Web] GitHub releases fetch failed: HTTP ${res.status}`);
            return null;
        }
        return (await res.json()) as GithubRelease;
    } catch (err) {
        console.warn('[Web] GitHub releases fetch error:', err);
        return null;
    }
}
