// ─── Tauri auto-updater manifest endpoint ─────────────────────────────────
// Reads the latest row from Turso `app_releases` and returns it in the
// shape that `@tauri-apps/plugin-updater` expects.
//
// Wire it up by setting (in src-tauri/tauri.conf.json):
//   "plugins": {
//     "updater": {
//       "endpoints": ["https://<your-vercel-domain>/api/manifest"]
//     }
//   }
//
// The desktop app's existing UpdateStatus flow (poll → pill → download →
// "Restart now / Later" modal) then runs against this endpoint instead of
// hitting GitHub directly.
// ─────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { tursoQuery } from '@/app/_lib/turso';

// Re-validate the cached response every 5 min — admin changes appear
// within that window without overloading Turso.
export const revalidate = 300;

interface TauriManifest {
    version: string;
    notes: string;
    pub_date: string;
    platforms: Record<string, { signature: string; url: string }>;
}

export async function GET() {
    try {
        const rows = await tursoQuery(
            `SELECT version, release_notes,
                    windows_file, windows_signature,
                    mac_file, mac_signature,
                    created_at
             FROM app_releases
             ORDER BY created_at DESC
             LIMIT 1`,
        );

        if (rows.length === 0) {
            return NextResponse.json(
                { error: 'No releases in app_releases table.' },
                { status: 404 },
            );
        }

        const row = rows[0];
        const platforms: TauriManifest['platforms'] = {};

        const winUrl = httpOrNull(row.windows_file);
        const macUrl = httpOrNull(row.mac_file);

        if (winUrl) {
            platforms['windows-x86_64'] = {
                signature: String(row.windows_signature ?? ''),
                url: winUrl,
            };
        }
        if (macUrl) {
            // One mac_file column for both arches — Tauri's updater picks the
            // platform key matching the running OS at runtime. If you ship
            // separate Intel/Apple-Silicon builds, store the aarch64 URL in
            // mac_file and they'll both end up pointing at the same bundle;
            // ARM machines will install the correct one if mac_file is the
            // aarch64 DMG, or you can split the table later.
            const macSig = String(row.mac_signature ?? '');
            platforms['darwin-x86_64'] = { signature: macSig, url: macUrl };
            platforms['darwin-aarch64'] = { signature: macSig, url: macUrl };
        }

        if (Object.keys(platforms).length === 0) {
            return NextResponse.json(
                {
                    error:
                        'Latest release row has no HTTP installer URLs. Admin must populate windows_file or mac_file via /super-admin/releases.',
                },
                { status: 404 },
            );
        }

        const manifest: TauriManifest = {
            version: String(row.version ?? '').replace(/^v/, ''),
            notes: String(row.release_notes ?? ''),
            pub_date: normalizeDate(String(row.created_at ?? '')),
            platforms,
        };

        return NextResponse.json(manifest, {
            headers: {
                // Tauri updater doesn't require any specific Cache-Control,
                // but a short edge cache helps under sudden launch spikes.
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
            },
        });
    } catch (err) {
        console.error('[Manifest API] error:', err);
        return NextResponse.json(
            { error: 'Failed to load manifest', details: String(err) },
            { status: 500 },
        );
    }
}

function httpOrNull(v: string | number | null | undefined): string | null {
    if (typeof v !== 'string') return null;
    return v.startsWith('http') ? v : null;
}

function normalizeDate(s: string): string {
    if (!s) return new Date().toISOString();
    const iso = s.includes('T') ? s : s.replace(' ', 'T') + 'Z';
    return new Date(iso).toISOString();
}
