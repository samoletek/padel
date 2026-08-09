const LAST_NAMES = 'padel-last-names';
const LOCAL_ROOM = 'padel-local-room';
const IDENTITY = 'padel-identity';

function read(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function write(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch { /* private mode, quota — not worth surfacing */ }
}

export const loadLastNames = () => read(LAST_NAMES, []);
export const saveLastNames = names => write(LAST_NAMES, names);

export const loadLocalRoom = () => read(LOCAL_ROOM, null);
export const saveLocalRoom = room => write(LOCAL_ROOM, room);
export const clearLocalRoom = () => {
    try { localStorage.removeItem(LOCAL_ROOM); } catch { }
};

export function loadIdentity(code) {
    const all = read(IDENTITY, {});
    return all[code] || null;
}

export function saveIdentity(code, playerId) {
    const all = read(IDENTITY, {});
    if (playerId) all[code] = playerId;
    else delete all[code];
    write(IDENTITY, all);
}
