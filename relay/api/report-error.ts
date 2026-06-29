// DineOS Error Relay — Vercel serverless function
// Accepts POST {source, message, app_version?, restaurant_id?} from production
// DineOS builds, sanitizes server-side, and files a wf:error ORBIT task.
// The real ORBIT key lives ONLY in the Vercel project env var (ORBIT_API_KEY);
// it is never returned to the client and never baked into the desktop binary.

import type { VercelRequest, VercelResponse } from '@vercel/node';

const ORBIT_KEY = process.env.ORBIT_API_KEY ?? '';
const ORBIT_URL = 'https://dailygoalmap.vercel.app/api/mcp';
const MAX_BODY_CHARS = 4_000;
const MAX_PER_HOUR_PER_IP = 20;
const MAX_PER_HOUR_GLOBAL = 100;

// Best-effort in-memory rate limiting (resets when the function instance recycles).
// A KV store would be needed for cross-instance enforcement if abuse becomes an issue.
const _ipCounts = new Map<string, { count: number; resetAt: number }>();
let _globalCount = 0;
let _globalReset = 0;

function sanitize(text: string): string {
    return text
        .replace(/AUTH_TOKEN=[^\s&"'\n]*/gi, 'AUTH_TOKEN=<redacted>')
        .replace(/DATABASE_URL=[^\s&"'\n]*/gi, 'DATABASE_URL=<redacted>')
        .replace(/libsql:\/\/[^\s"'\n]*/gi, 'libsql://<redacted>')
        .replace(/dgm_[A-Za-z0-9]+/g, '<orbit-key-redacted>')
        .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '<card-redacted>')
        .replace(/"password"\s*:\s*"[^"]*"/gi, '"password":"<redacted>"')
        .replace(/"pin"\s*:\s*"[^"]*"/gi, '"pin":"<redacted>"')
        .replace(/"pin_hash"\s*:\s*"[^"]*"/gi, '"pin_hash":"<redacted>"');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!ORBIT_KEY) {
        return res.status(503).json({ error: 'Relay not configured' });
    }

    const ip =
        (req.headers['x-forwarded-for'] as string | undefined)
            ?.split(',')[0]
            ?.trim() ?? 'unknown';

    const now = Date.now();

    if (now > _globalReset) {
        _globalCount = 0;
        _globalReset = now + 3_600_000;
    }
    if (_globalCount >= MAX_PER_HOUR_GLOBAL) {
        return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    const ipEntry = _ipCounts.get(ip) ?? { count: 0, resetAt: now + 3_600_000 };
    if (now > ipEntry.resetAt) {
        ipEntry.count = 0;
        ipEntry.resetAt = now + 3_600_000;
    }
    if (ipEntry.count >= MAX_PER_HOUR_PER_IP) {
        return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    ipEntry.count++;
    _ipCounts.set(ip, ipEntry);
    _globalCount++;

    const body = req.body as Record<string, unknown> | undefined;
    if (!body || typeof body.source !== 'string' || typeof body.message !== 'string') {
        return res.status(400).json({ error: 'source and message are required' });
    }

    const source = String(body.source).slice(0, 100);
    const appVersion = String(body.app_version ?? 'unknown').slice(0, 20);
    const rawMessage = String(body.message).slice(0, MAX_BODY_CHARS);
    const message = sanitize(rawMessage);
    const firstLine = message.split('\n')[0].slice(0, 80);

    try {
        const upstream = await fetch(ORBIT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Project-Api-Key': ORBIT_KEY,
            },
            body: JSON.stringify({
                tool: 'tasks.create',
                input: {
                    title: `[prod-error] ${source}: ${firstLine}`,
                    description: `**Source:** ${source}\n**App version:** ${appVersion}\n\n**Error:**\n\`\`\`\n${message}\n\`\`\``,
                    tags: ['wf:error', 'assign:code-reviewer', 'project:dineos'],
                },
            }),
        });
        if (!upstream.ok) {
            return res.status(502).json({ error: 'Upstream failed' });
        }
        return res.status(201).json({ ok: true });
    } catch {
        return res.status(502).json({ error: 'Upstream unavailable' });
    }
}
