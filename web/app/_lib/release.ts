// ─── Server-only — DO NOT import from a Client Component ─────────────────
// Source-of-truth chain for the "latest release" data shown on the landing:
//   1. Turso `app_releases` table (admin manages via the in-app
//      /super-admin/releases page — single source of truth).
//   2. If Turso is empty / failing, fall back to GitHub Releases API using
//      GIT_TOKEN (5000 req/hr authenticated; 60 req/hr anonymous).
// The token never enters the browser bundle because everything in this file
// runs server-side only.
// ─────────────────────────────────────────────────────────────────────────

if (typeof window !== 'undefined') {
    throw new Error(
        '_lib/release.ts is server-only. Do not import it from a Client Component.',
    );
}

import { tursoQuery } from './turso';

const REPO = 'DaraBoth/pos_restaurant';
const GITHUB_ENDPOINT = `https://api.github.com/repos/${REPO}/releases/latest`;

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

export async function fetchLatestRelease(): Promise<GithubRelease | null> {
    // Try the in-app admin's release table first.
    try {
        const fromDb = await fetchFromTurso();
        if (fromDb) {
            console.info(`[Web] release served from Turso: ${fromDb.tag_name}`);
            return fromDb;
        }
        console.info('[Web] Turso has no releases yet; falling back to GitHub');
    } catch (err) {
        console.warn('[Web] Turso fetch failed, falling back to GitHub:', err);
    }

    return fetchFromGithub();
}

// ─── Turso path ────────────────────────────────────────────────────────────

async function fetchFromTurso(): Promise<GithubRelease | null> {
    const rows = await tursoQuery(
        `SELECT id, version, release_notes,
                windows_file, windows_signature,
                mac_file, mac_signature,
                created_at
         FROM app_releases
         ORDER BY created_at DESC
         LIMIT 1`,
    );
    if (rows.length === 0) return null;

    const row = rows[0];
    const tag = `v${String(row.version ?? '').replace(/^v/, '')}`;

    // Each row carries up to two installer URLs (windows_file, mac_file).
    // Probe their sizes in parallel so the UI shows the same "12.4 MB"
    // chips it would have shown when reading the GitHub API directly.
    const winUrl = httpOrNull(row.windows_file);
    const macUrl = httpOrNull(row.mac_file);
    const [winSize, macSize] = await Promise.all([
        winUrl ? probeSize(winUrl) : Promise.resolve(0),
        macUrl ? probeSize(macUrl) : Promise.resolve(0),
    ]);

    const assets: GithubAsset[] = [];
    if (winUrl) {
        assets.push({
            name: filenameOf(winUrl, 'msi'),
            browser_download_url: winUrl,
            size: winSize,
            content_type: 'application/octet-stream',
        });
    }
    if (macUrl) {
        // The DB has one mac_file column — surface it as both Intel and
        // Apple Silicon assets so the LandingPage download cards both
        // resolve. Universal DMGs are common; if you ship two separate
        // builds, store the aarch64 URL in mac_file (the page's
        // pickMacArm regex looks for "aarch64"/"arm64"/"apple-silicon" in
        // the filename so it'll route correctly to the ARM card).
        assets.push({
            name: filenameOf(macUrl, 'dmg'),
            browser_download_url: macUrl,
            size: macSize,
            content_type: 'application/octet-stream',
        });
    }

    return {
        tag_name: tag,
        name: tag,
        published_at: normalizeDate(String(row.created_at ?? '')),
        body: String(row.release_notes ?? ''),
        html_url: '', // not surfaced from Turso; landing no longer uses it
        assets,
    };
}

function httpOrNull(v: string | number | null | undefined): string | null {
    if (typeof v !== 'string') return null;
    return v.startsWith('http') ? v : null;
}

function filenameOf(url: string, fallbackExt: string): string {
    const last = url.split('/').pop() || '';
    return last.includes('.') ? last : `DineOS-installer.${fallbackExt}`;
}

function normalizeDate(s: string): string {
    if (!s) return new Date().toISOString();
    // SQLite "2026-05-28 14:23:01" → ISO "2026-05-28T14:23:01Z"
    const iso = s.includes('T') ? s : s.replace(' ', 'T') + 'Z';
    return new Date(iso).toISOString();
}

async function probeSize(url: string): Promise<number> {
    try {
        const res = await fetch(url, {
            method: 'HEAD',
            redirect: 'follow',
            next: { revalidate: 3600 },
        });
        const len = res.headers.get('content-length');
        return len ? parseInt(len, 10) : 0;
    } catch {
        return 0;
    }
}

// ─── GitHub fallback ───────────────────────────────────────────────────────

async function fetchFromGithub(): Promise<GithubRelease | null> {
    const token = process.env.GIT_TOKEN;
    const headers: HeadersInit = {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    try {
        const res = await fetch(GITHUB_ENDPOINT, {
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
