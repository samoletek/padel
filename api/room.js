import { createRoom as buildRoom, PLAYER_COUNTS, FORMATS, POINT_OPTIONS, maxCourtsFor, clampRounds } from '../shared/engine.js';
import { createRoom, readRoom, readVersion, normalizeCode, sendError, syncConfigured } from './_store.js';

const MAX_NAME_LENGTH = 24;

function cleanNames(list, limit) {
    if (!Array.isArray(list)) return [];
    return list
        .slice(0, limit)
        .map(name => String(name ?? '').trim().slice(0, MAX_NAME_LENGTH));
}

export default async function handler(req, res) {
    if (!syncConfigured()) {
        return sendError(res, 503, 'Room sync is not configured on this deployment', 'sync_unavailable');
    }

    try {
        if (req.method === 'GET') {
            const url = new URL(req.url, 'http://localhost');
            const code = normalizeCode(url.searchParams.get('code'));
            if (!code) return sendError(res, 400, 'Room code is required', 'bad_request');

            // A poll that is already up to date reads the version key only,
            // never the whole room.
            const since = Number(url.searchParams.get('v'));
            if (Number.isFinite(since)) {
                const current = await readVersion(code);
                if (current !== null && current === since) {
                    return res.status(200).json({ unchanged: true, version: current });
                }
            }

            const room = await readRoom(code);
            if (!room) return sendError(res, 404, 'Room not found', 'not_found');

            return res.status(200).json({ room });
        }

        if (req.method === 'POST') {
            const body = req.body || {};
            const format = FORMATS.includes(body.format) ? body.format : 'americano';

            const playerNames = cleanNames(body.playerNames, 24);
            if (!PLAYER_COUNTS.includes(playerNames.length)) {
                return sendError(res, 400, 'Unsupported number of players', 'bad_request');
            }
            if (playerNames.some(name => !name)) {
                return sendError(res, 400, 'Every player needs a name', 'bad_request');
            }

            const courtLimit = maxCourtsFor(playerNames.length);
            const courtNames = cleanNames(body.courtNames, courtLimit);
            if (courtNames.length < 1 || courtNames.length > courtLimit) {
                return sendError(res, 400, 'Unsupported number of courts', 'bad_request');
            }

            const pointsPerMatch = POINT_OPTIONS.includes(Number(body.pointsPerMatch))
                ? Number(body.pointsPerMatch)
                : 16;
            const endless = Boolean(body.endless);
            const rounds = clampRounds(body.rounds);

            const room = await createRoom(code =>
                buildRoom({
                    code,
                    format,
                    playerNames,
                    courtNames,
                    rounds,
                    endless,
                    pointsPerMatch,
                    seed: Math.floor(Math.random() * 2 ** 31),
                }),
            );

            return res.status(201).json({ room });
        }

        res.setHeader('Allow', 'GET, POST');
        return sendError(res, 405, 'Method not allowed', 'method_not_allowed');
    } catch (err) {
        if (err.code === 'sync_unavailable') {
            return sendError(res, 503, 'Room sync is not configured', 'sync_unavailable');
        }
        console.error('Room API error:', err);
        return sendError(res, 500, err.message || 'Internal server error', 'server_error');
    }
}
