// Runtime error reporter — two code paths:
//   Dev builds  (NODE_ENV=development): POST directly to ORBIT if NEXT_PUBLIC_ORBIT_DEV_KEY is set.
//   Prod builds (NODE_ENV=production):  POST to the relay if NEXT_PUBLIC_ERROR_RELAY_URL is set.
//                                       The relay holds the ORBIT key server-side; the URL alone is
//                                       low-value (can only file error tasks, not read/delete).
// To enable in local dev: add NEXT_PUBLIC_ORBIT_DEV_KEY=<key> to .env (already gitignored).
// To enable in prod: set NEXT_PUBLIC_ERROR_RELAY_URL=<relay-url> in the CI build environment
//   after the relay is deployed. See relay/ for the serverless function.

const IS_DEV = process.env.NODE_ENV === 'development';
const DEV_ORBIT_KEY = process.env.NEXT_PUBLIC_ORBIT_DEV_KEY ?? '';
const RELAY_URL = process.env.NEXT_PUBLIC_ERROR_RELAY_URL ?? '';
const ORBIT_URL = 'https://dailygoalmap.vercel.app/api/mcp';
const MAX_PER_HOUR = 10;

const _reported = new Set<string>();
let _hourlyCount = 0;
let _hourlyReset = 0;

function sanitize(text: string): string {
    return text
        .replace(/AUTH_TOKEN=[^\s&"'\n]*/gi, 'AUTH_TOKEN=<redacted>')
        .replace(/DATABASE_URL=[^\s&"'\n]*/gi, 'DATABASE_URL=<redacted>')
        .replace(/libsql:\/\/[^\s"'\n]*/gi, 'libsql://<redacted>')
        .replace(/dgm_[A-Za-z0-9]+/g, '<orbit-key-redacted>')
        .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '<card-redacted>');
}

function dedupeKey(source: string, message: string): string {
    const firstLine = message.split('\n')[0].slice(0, 120);
    return `${source}::${firstLine}`;
}

export async function reportError(
    source: string,
    rawMessage: string,
): Promise<void> {
    const canUseDev = IS_DEV && !!DEV_ORBIT_KEY;
    const canUseProd = !IS_DEV && !!RELAY_URL;
    if (!canUseDev && !canUseProd) return;

    const now = Date.now();
    if (now > _hourlyReset) {
        _hourlyCount = 0;
        _hourlyReset = now + 3_600_000;
    }
    if (_hourlyCount >= MAX_PER_HOUR) return;

    const key = dedupeKey(source, rawMessage);
    if (_reported.has(key)) return;
    _reported.add(key);
    _hourlyCount++;

    const message = sanitize(rawMessage).slice(0, 2000);
    const firstLine = message.split('\n')[0].slice(0, 80);

    try {
        if (canUseDev) {
            await fetch(ORBIT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Project-Api-Key': DEV_ORBIT_KEY,
                },
                body: JSON.stringify({
                    tool: 'tasks.create',
                    input: {
                        title: `[runtime-error] ${source}: ${firstLine}`,
                        description: `**Source:** ${source}\n\n**Error:**\n\`\`\`\n${message}\n\`\`\``,
                        tags: ['wf:error', 'assign:code-reviewer', 'project:dineos'],
                    },
                }),
            });
        } else {
            await fetch(RELAY_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ source, message, app_version: 'unknown' }),
            });
        }
    } catch {
        // Swallow — reporter must never crash the app.
    }
}
