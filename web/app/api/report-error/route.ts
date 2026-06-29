// DineOS error relay — receives POST {source, message, app_version?} from
// production desktop builds, sanitizes server-side, and files a wf:error
// ORBIT task. The real ORBIT key lives only in this Vercel project's env
// vars — it is never returned to the client or baked into the desktop binary.

import { NextRequest, NextResponse } from 'next/server';

const ORBIT_KEY = process.env.ORBIT_API_KEY ?? '';
const ORBIT_URL = 'https://dailygoalmap.vercel.app/api/mcp';
const MAX_BODY_CHARS = 4_000;
const MAX_PER_HOUR_PER_IP = 20;
const MAX_PER_HOUR_GLOBAL = 100;

// Best-effort in-memory rate limiting per serverless instance.
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

export async function POST(req: NextRequest) {
    if (!ORBIT_KEY) {
        return NextResponse.json({ error: 'Relay not configured' }, { status: 503 });
    }

    const ip =
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

    const now = Date.now();

    if (now > _globalReset) {
        _globalCount = 0;
        _globalReset = now + 3_600_000;
    }
    if (_globalCount >= MAX_PER_HOUR_GLOBAL) {
        return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const ipEntry = _ipCounts.get(ip) ?? { count: 0, resetAt: now + 3_600_000 };
    if (now > ipEntry.resetAt) {
        ipEntry.count = 0;
        ipEntry.resetAt = now + 3_600_000;
    }
    if (ipEntry.count >= MAX_PER_HOUR_PER_IP) {
        return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }
    ipEntry.count++;
    _ipCounts.set(ip, ipEntry);
    _globalCount++;

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    if (typeof body.source !== 'string' || typeof body.message !== 'string') {
        return NextResponse.json(
            { error: 'source and message are required strings' },
            { status: 400 },
        );
    }

    const source = body.source.slice(0, 100);
    const appVersion = String(body.app_version ?? 'unknown').slice(0, 20);
    const message = sanitize(body.message.slice(0, MAX_BODY_CHARS));
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
            return NextResponse.json({ error: 'Upstream failed' }, { status: 502 });
        }
        return NextResponse.json({ ok: true }, { status: 201 });
    } catch {
        return NextResponse.json({ error: 'Upstream unavailable' }, { status: 502 });
    }
}
