import { applyAction } from '../shared/engine.js';
import { mutateRoom, normalizeCode, sendError, syncConfigured } from './_store.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return sendError(res, 405, 'Method not allowed', 'method_not_allowed');
    }

    if (!syncConfigured()) {
        return sendError(res, 503, 'Room sync is not configured on this deployment', 'sync_unavailable');
    }

    const body = req.body || {};
    const code = normalizeCode(body.code);
    const action = body.action;

    if (!code) return sendError(res, 400, 'Room code is required', 'bad_request');
    if (!action || typeof action.type !== 'string') {
        return sendError(res, 400, 'An action is required', 'bad_request');
    }

    try {
        const room = await mutateRoom(code, current => applyAction(current, action));
        if (!room) return sendError(res, 404, 'Room not found', 'not_found');
        return res.status(200).json({ room });
    } catch (err) {
        if (err.code === 'sync_unavailable') {
            return sendError(res, 503, 'Room sync is not configured', 'sync_unavailable');
        }
        if (err.code === 'conflict') {
            return sendError(res, 409, err.message, 'conflict');
        }
        // Engine rejections (court busy, player already on court, …) are user errors.
        console.warn('Action rejected:', action.type, err.message);
        return sendError(res, 422, err.message || 'Action failed', 'rejected');
    }
}
