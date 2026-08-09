async function parse(response) {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(body.error || `Request failed (${response.status})`);
        error.code = body.code || 'server_error';
        error.status = response.status;
        throw error;
    }
    return body;
}

export async function createRoom(payload) {
    const response = await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const body = await parse(response);
    return body.room;
}

export async function fetchRoom(code, version) {
    const params = new URLSearchParams({ code });
    if (Number.isFinite(version)) params.set('v', String(version));
    const response = await fetch(`/api/room?${params}`, { cache: 'no-store' });
    return parse(response);
}

export async function sendAction(code, action) {
    const response = await fetch('/api/act', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, action }),
    });
    const body = await parse(response);
    return body.room;
}
