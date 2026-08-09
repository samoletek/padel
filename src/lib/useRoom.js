import { useCallback, useEffect, useRef, useState } from 'react';
import { applyAction } from '../../shared/engine.js';
import { fetchRoom, sendAction } from './api.js';
import { saveLocalRoom } from './storage.js';

const POLL_INTERVAL_MS = 3000;
const POLL_INTERVAL_HIDDEN_MS = 15000;

const clone = room =>
    (typeof structuredClone === 'function' ? structuredClone(room) : JSON.parse(JSON.stringify(room)));

/**
 * Holds one room and keeps it in step with the server.
 *
 * Actions are applied locally first so the phone that tapped feels instant,
 * then confirmed by the API. Polls are ignored while a write is in flight so a
 * slow response cannot resurrect stale state.
 */
export default function useRoom(initialRoom, { local = false } = {}) {
    const [room, setRoom] = useState(initialRoom);
    const [connection, setConnection] = useState(local ? 'local' : 'live');
    const [actionError, setActionError] = useState(null);

    const roomRef = useRef(initialRoom);
    const inFlightRef = useRef(0);

    useEffect(() => {
        roomRef.current = room;
        if (local && room) saveLocalRoom(room);
    }, [room, local]);

    useEffect(() => {
        setRoom(initialRoom);
        roomRef.current = initialRoom;
    }, [initialRoom?.code]); // eslint-disable-line react-hooks/exhaustive-deps

    const code = room?.code;

    useEffect(() => {
        if (local || !code) return undefined;

        let cancelled = false;
        let timer = null;

        const tick = async () => {
            if (cancelled) return;

            if (inFlightRef.current === 0) {
                try {
                    const result = await fetchRoom(code, roomRef.current?.version);
                    if (cancelled) return;
                    if (result.room && inFlightRef.current === 0) setRoom(result.room);
                    setConnection('live');
                } catch (err) {
                    if (cancelled) return;
                    setConnection(err.code === 'not_found' ? 'missing' : 'offline');
                }
            }

            const delay = document.hidden ? POLL_INTERVAL_HIDDEN_MS : POLL_INTERVAL_MS;
            timer = setTimeout(tick, delay);
        };

        timer = setTimeout(tick, POLL_INTERVAL_MS);

        const onVisible = () => {
            if (document.hidden) return;
            clearTimeout(timer);
            tick();
        };

        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('focus', onVisible);

        return () => {
            cancelled = true;
            clearTimeout(timer);
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener('focus', onVisible);
        };
    }, [code, local]);

    const act = useCallback(async (action) => {
        const current = roomRef.current;
        if (!current) return false;

        const optimistic = clone(current);
        try {
            applyAction(optimistic, action);
        } catch (err) {
            setActionError(err.message);
            return false;
        }

        setActionError(null);
        setRoom(optimistic);
        roomRef.current = optimistic;

        if (local) return true;

        inFlightRef.current += 1;
        try {
            const confirmed = await sendAction(current.code, action);
            setRoom(confirmed);
            roomRef.current = confirmed;
            setConnection('live');
            return true;
        } catch (err) {
            setRoom(current);
            roomRef.current = current;
            if (err.code === 'rejected' || err.code === 'conflict') {
                setActionError(err.message);
            } else {
                setConnection('offline');
                setActionError(err.message);
            }
            return false;
        } finally {
            inFlightRef.current -= 1;
        }
    }, [local]);

    return { room, connection, act, actionError, dismissError: () => setActionError(null) };
}
