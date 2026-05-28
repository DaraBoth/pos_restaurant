// ─── Server-only — DO NOT import from a Client Component ─────────────────
// Tiny HTTP wrapper around Turso's Hrana/pipeline endpoint. We use fetch()
// (works in both Edge and Node runtimes) instead of the official
// @libsql/client to avoid a Vercel runtime dependency and to keep the
// install graph identical to what's already in package.json.
// ─────────────────────────────────────────────────────────────────────────

if (typeof window !== 'undefined') {
    throw new Error(
        '_lib/turso.ts is server-only. Do not import it from a Client Component.',
    );
}

const RAW_URL = process.env.TURSO_DATABASE_URL ?? '';
const TOKEN = process.env.TURSO_AUTH_TOKEN ?? '';

type ArgValue = string | number | null;

interface TursoCell {
    type: 'integer' | 'text' | 'null' | 'float' | 'blob';
    value: string | null;
}

export type TursoRow = Record<string, string | number | null>;

function pipelineUrl(): string {
    return RAW_URL.replace(/^libsql:\/\//, 'https://') + '/v2/pipeline';
}

function bindArg(value: ArgValue): { type: string; value: string | null } {
    if (value === null) return { type: 'null', value: null };
    if (typeof value === 'number') return { type: 'integer', value: String(value) };
    return { type: 'text', value: String(value) };
}

/**
 * Run one SQL statement against Turso via the HTTP pipeline. Returns rows as
 * column-keyed plain objects. Throws on transport or query errors.
 */
export async function tursoQuery(sql: string, args: ArgValue[] = []): Promise<TursoRow[]> {
    if (!RAW_URL || !TOKEN) {
        throw new Error('TURSO_DATABASE_URL or TURSO_AUTH_TOKEN is missing');
    }

    const body = {
        requests: [
            {
                type: 'execute',
                stmt: { sql, args: args.map(bindArg) },
            },
            { type: 'close' },
        ],
    };

    const res = await fetch(pipelineUrl(), {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        // Server-side cache; auto-revalidates every 5 min so admin changes
        // surface promptly without hammering the DB on every request.
        next: { revalidate: 300 },
    });

    if (!res.ok) {
        throw new Error(`Turso HTTP ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    const result = data.results?.[0];
    if (result?.type !== 'ok') {
        throw new Error(`Turso query failed: ${JSON.stringify(result)}`);
    }

    const cols = (result.response.result.cols as { name: string }[]) ?? [];
    const rows = (result.response.result.rows as TursoCell[][]) ?? [];

    return rows.map(row => {
        const obj: TursoRow = {};
        cols.forEach((col, i) => {
            const cell = row[i];
            if (!cell || cell.type === 'null') obj[col.name] = null;
            else if (cell.type === 'integer') obj[col.name] = parseInt(cell.value ?? '0', 10);
            else obj[col.name] = cell.value;
        });
        return obj;
    });
}
