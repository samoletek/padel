import { createClient } from 'redis';

const KEY_PREFIX = 'padel:room:';
const ROOM_TTL_SECONDS = 60 * 60 * 24 * 7;
const CODE_ALPHABET = 'ACDEFGHJKLMNPQRTUVWXY34679';
const CODE_LENGTH = 4;
const MUTATE_ATTEMPTS = 6;
const CONNECT_TIMEOUT_MS = 4000;
const MAX_RECONNECT_ATTEMPTS = 3;

let clientPromise = null;

/**
 * Vercel prefixes a marketplace store's variable with the store name when
 * `REDIS_URL` is already taken on the project, so accept either spelling
 * rather than depending on how the database happened to be attached.
 */
function redisUrl() {
    if (process.env.REDIS_URL) return process.env.REDIS_URL;
    const key = Object.keys(process.env).find(
        name => name.endsWith('REDIS_URL') && process.env[name],
    );
    return key ? process.env[key] : null;
}

export function syncConfigured() {
    return Boolean(redisUrl());
}

async function getClient() {
    if (!syncConfigured()) {
        const error = new Error('Room sync is not configured');
        error.code = 'sync_unavailable';
        throw error;
    }

    if (!clientPromise) {
        const client = createClient({
            url: redisUrl(),
            socket: {
                connectTimeout: CONNECT_TIMEOUT_MS,
                // Give up rather than retrying forever: a request that can't
                // reach Redis must fail fast so the client falls back instead
                // of hanging until the function times out.
                reconnectStrategy: retries =>
                    (retries >= MAX_RECONNECT_ATTEMPTS
                        ? new Error('Redis is unreachable')
                        : Math.min((retries + 1) * 200, 1000)),
            },
        });

        client.on('error', err => console.error('Redis error:', err.message));

        const pending = client.connect().then(() => client).catch(err => {
            if (clientPromise === pending) clientPromise = null;
            const error = new Error('Room storage is unreachable');
            error.code = 'sync_unavailable';
            error.cause = err;
            throw error;
        });

        // Drop the cached client once it closes so the next request reconnects.
        client.on('end', () => {
            if (clientPromise === pending) clientPromise = null;
        });

        clientPromise = pending;
    }

    return clientPromise;
}

const keyFor = code => `${KEY_PREFIX}${String(code || '').toUpperCase()}`;

export function normalizeCode(code) {
    return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

function randomCode() {
    let out = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
        out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    return out;
}

export async function readRoom(code) {
    const client = await getClient();
    const raw = await client.get(keyFor(code));
    return raw ? JSON.parse(raw) : null;
}

/** Claims an unused code and stores the room built by `build(code)`. */
export async function createRoom(build) {
    const client = await getClient();

    for (let attempt = 0; attempt < 10; attempt++) {
        const code = randomCode();
        const room = build(code);
        const stored = await client.set(keyFor(code), JSON.stringify(room), {
            NX: true,
            EX: ROOM_TTL_SECONDS,
        });
        if (stored) return room;
    }

    throw new Error('Could not allocate a room code, please retry');
}

/**
 * Read–modify–write guarded by WATCH so two phones submitting at the same
 * moment cannot clobber each other.
 */
export async function mutateRoom(code, mutator) {
    const client = await getClient();
    const key = keyFor(code);

    for (let attempt = 0; attempt < MUTATE_ATTEMPTS; attempt++) {
        await client.watch(key);
        const raw = await client.get(key);

        if (!raw) {
            await client.unwatch();
            return null;
        }

        const room = JSON.parse(raw);
        let changed;

        try {
            changed = mutator(room);
        } catch (err) {
            await client.unwatch();
            throw err;
        }

        if (!changed) {
            await client.unwatch();
            return room;
        }

        room.version = (room.version || 0) + 1;
        room.updatedAt = Date.now();

        const result = await client
            .multi()
            .set(key, JSON.stringify(room), { EX: ROOM_TTL_SECONDS })
            .exec();

        if (result) return room;
    }

    const error = new Error('Room was busy, please try again');
    error.code = 'conflict';
    throw error;
}

export function sendError(res, status, message, code) {
    return res.status(status).json({ error: message, code });
}
