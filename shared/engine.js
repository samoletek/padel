/**
 * Padel Mix engine — pure, dependency-free logic shared by the browser and the
 * serverless API so that an offline room and a synced room behave identically.
 */

export const FORMATS = ['americano', 'mexicano', 'teamAmericano'];
export const PLAYER_COUNTS = [4, 8, 12, 16, 20, 24];
export const POINT_OPTIONS = [16, 21, 24, 32];
export const PLAYERS_PER_MATCH = 4;
export const MIN_ROUNDS = 3;
export const MAX_ROUNDS = 20;

const PARTNER_WEIGHT = 12;
const OPPONENT_WEIGHT = 1;
const ARRANGE_ATTEMPTS = 240;
const LOCAL_SEARCH_PASSES = 60;

/* ===== helpers ===== */

export function mulberry32(seed) {
    let a = seed >>> 0;
    return function rng() {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function shuffle(list, rng) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

export function maxCourtsFor(playerCount) {
    return Math.max(1, Math.floor(playerCount / PLAYERS_PER_MATCH));
}

export function courtOptionsFor(playerCount) {
    const max = maxCourtsFor(playerCount);
    return Array.from({ length: max }, (_, i) => i + 1);
}

export function defaultRoundsFor(playerCount) {
    if (playerCount <= 4) return 3;
    return Math.min(9, playerCount - 1);
}

/* ===== pair bookkeeping ===== */

function pairKey(a, b) {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function emptyStats(playerIds) {
    const games = {};
    const restStreak = {};
    for (const id of playerIds) {
        games[id] = 0;
        restStreak[id] = 0;
    }
    return { games, restStreak, partner: {}, opponent: {} };
}

function partnerCount(stats, a, b) {
    return stats.partner[pairKey(a, b)] || 0;
}

function opponentCount(stats, a, b) {
    return stats.opponent[pairKey(a, b)] || 0;
}

function penalty(count, weight) {
    return count === 0 ? 0 : weight * count * count;
}

function bestSplit(stats, group) {
    const layouts = [
        [0, 1, 2, 3],
        [0, 2, 1, 3],
        [0, 3, 1, 2],
    ];

    let bestTeams = null;
    let bestCost = Infinity;

    for (const [i, j, k, l] of layouts) {
        const a1 = group[i];
        const a2 = group[j];
        const b1 = group[k];
        const b2 = group[l];

        const cost =
            penalty(partnerCount(stats, a1, a2), PARTNER_WEIGHT) +
            penalty(partnerCount(stats, b1, b2), PARTNER_WEIGHT) +
            penalty(opponentCount(stats, a1, b1), OPPONENT_WEIGHT) +
            penalty(opponentCount(stats, a1, b2), OPPONENT_WEIGHT) +
            penalty(opponentCount(stats, a2, b1), OPPONENT_WEIGHT) +
            penalty(opponentCount(stats, a2, b2), OPPONENT_WEIGHT);

        if (cost < bestCost) {
            bestCost = cost;
            bestTeams = [[a1, a2], [b1, b2]];
        }
    }

    return { teams: bestTeams, cost: bestCost };
}

function evaluateOrder(order, stats) {
    const groups = [];
    let cost = 0;
    for (let i = 0; i < order.length; i += PLAYERS_PER_MATCH) {
        const split = bestSplit(stats, order.slice(i, i + PLAYERS_PER_MATCH));
        groups.push(split.teams);
        cost += split.cost;
    }
    return { groups, cost };
}

function arrangeGroups(active, stats, rng) {
    let bestOrder = active;
    let bestCost = Infinity;

    for (let attempt = 0; attempt < ARRANGE_ATTEMPTS; attempt++) {
        const order = shuffle(active, rng);
        const { cost } = evaluateOrder(order, stats);
        if (cost < bestCost) {
            bestCost = cost;
            bestOrder = order;
        }
        if (bestCost === 0) break;
    }

    let order = bestOrder;
    let cost = bestCost;

    for (let pass = 0; pass < LOCAL_SEARCH_PASSES && cost > 0; pass++) {
        let improved = false;

        for (let i = 0; i < order.length && !improved; i++) {
            for (let j = i + 1; j < order.length; j++) {
                const sameGroup =
                    Math.floor(i / PLAYERS_PER_MATCH) === Math.floor(j / PLAYERS_PER_MATCH);
                if (sameGroup) continue;

                const candidate = order.slice();
                [candidate[i], candidate[j]] = [candidate[j], candidate[i]];
                const candidateCost = evaluateOrder(candidate, stats).cost;

                if (candidateCost < cost) {
                    order = candidate;
                    cost = candidateCost;
                    improved = true;
                    break;
                }
            }
        }

        if (!improved) break;
    }

    return evaluateOrder(order, stats).groups;
}

function pickActive(playerIds, stats, needed, rng) {
    const keyed = playerIds.map(id => ({
        id,
        games: stats.games[id],
        rest: stats.restStreak[id],
        tiebreak: rng(),
    }));

    keyed.sort((x, y) =>
        x.games - y.games ||
        y.rest - x.rest ||
        x.tiebreak - y.tiebreak
    );

    return keyed.slice(0, needed).map(entry => entry.id);
}

function commitRound(teamsPerCourt, stats, playerIds) {
    const played = new Set();

    for (const [teamA, teamB] of teamsPerCourt) {
        stats.partner[pairKey(teamA[0], teamA[1])] = partnerCount(stats, teamA[0], teamA[1]) + 1;
        stats.partner[pairKey(teamB[0], teamB[1])] = partnerCount(stats, teamB[0], teamB[1]) + 1;

        for (const a of teamA) {
            for (const b of teamB) {
                stats.opponent[pairKey(a, b)] = opponentCount(stats, a, b) + 1;
            }
        }

        for (const id of [...teamA, ...teamB]) {
            stats.games[id] += 1;
            stats.restStreak[id] = 0;
            played.add(id);
        }
    }

    for (const id of playerIds) {
        if (!played.has(id)) stats.restStreak[id] += 1;
    }
}

/* ===== schedule builders ===== */

function buildAmericano(playerIds, courtCount, rounds, rng) {
    const stats = emptyStats(playerIds);
    const perRound = Math.min(courtCount, Math.floor(playerIds.length / PLAYERS_PER_MATCH));
    const schedule = [];

    for (let round = 0; round < rounds; round++) {
        const active = pickActive(playerIds, stats, perRound * PLAYERS_PER_MATCH, rng);
        const groups = arrangeGroups(active, stats, rng);
        commitRound(groups, stats, playerIds);
        schedule.push(groups);
    }

    return schedule;
}

function buildFixedPairs(playerIds, rng) {
    const order = shuffle(playerIds, rng);
    const pairs = [];
    for (let i = 0; i < order.length; i += 2) {
        pairs.push([order[i], order[i + 1]]);
    }
    return pairs;
}

function buildTeamAmericano(pairs, courtCount, rounds, rng, history) {
    const pairCount = pairs.length;
    const perRound = Math.min(courtCount, Math.floor(pairCount / 2));
    const met = history?.met ? { ...history.met } : {};
    const games = history?.games ? history.games.slice() : pairs.map(() => 0);
    const schedule = [];

    for (let round = 0; round < rounds; round++) {
        const used = new Set();
        const groups = [];

        while (groups.length < perRound) {
            let best = null;
            let bestCost = Infinity;

            for (let x = 0; x < pairCount; x++) {
                if (used.has(x)) continue;
                for (let y = x + 1; y < pairCount; y++) {
                    if (used.has(y)) continue;
                    const repeats = met[pairKey(String(x), String(y))] || 0;
                    const cost =
                        penalty(repeats, 100) +
                        (games[x] + games[y]) * 4 +
                        rng();
                    if (cost < bestCost) {
                        bestCost = cost;
                        best = [x, y];
                    }
                }
            }

            if (!best) break;

            const [x, y] = best;
            used.add(x);
            used.add(y);
            met[pairKey(String(x), String(y))] = (met[pairKey(String(x), String(y))] || 0) + 1;
            games[x] += 1;
            games[y] += 1;
            groups.push([pairs[x], pairs[y]]);
        }

        schedule.push(groups);
    }

    return schedule;
}

/* ===== room construction ===== */

function makePlayers(names) {
    return names.map((name, index) => ({
        id: `p${index}`,
        name: String(name || '').trim() || `Player ${index + 1}`,
    }));
}

function makeCourts(names) {
    return names.map((name, index) => ({
        id: `c${index}`,
        name: String(name || '').trim() || `Court ${index + 1}`,
    }));
}

function materialize(schedule, courts, startRound, startSeq) {
    const matches = [];
    let seq = startSeq;

    schedule.forEach((groups, roundOffset) => {
        groups.forEach((teams, courtIndex) => {
            matches.push({
                id: `m${seq++}`,
                round: startRound + roundOffset,
                court: courts[courtIndex % courts.length].id,
                a: teams[0],
                b: teams[1],
                status: 'pending',
                scoreA: null,
                scoreB: null,
                startedAt: null,
                endedAt: null,
            });
        });
    });

    return { matches, seq };
}

export function createRoom({
    code,
    format = 'americano',
    playerNames = [],
    courtNames = [],
    rounds,
    pointsPerMatch = 24,
    seed = Date.now(),
}) {
    if (!FORMATS.includes(format)) throw new Error(`Unknown format: ${format}`);

    const players = makePlayers(playerNames);
    const courts = makeCourts(courtNames);

    if (players.length < PLAYERS_PER_MATCH) throw new Error('At least 4 players are required');
    if (players.length % 2 !== 0) throw new Error('Player count must be even');
    if (courts.length < 1) throw new Error('At least one court is required');
    if (courts.length > maxCourtsFor(players.length)) {
        throw new Error('More courts than players can fill');
    }

    const roundsPlanned = clampRounds(rounds ?? defaultRoundsFor(players.length));
    const rng = mulberry32(seed);
    const playerIds = players.map(p => p.id);

    const room = {
        code,
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        format,
        pointsPerMatch,
        roundsPlanned,
        seed,
        players,
        courts,
        pairs: null,
        matches: [],
        matchSeq: 0,
    };

    if (format === 'teamAmericano') {
        const pairs = buildFixedPairs(playerIds, rng);
        room.pairs = pairs;
        const schedule = buildTeamAmericano(pairs, courts.length, roundsPlanned, rng);
        const built = materialize(schedule, courts, 0, 0);
        room.matches = built.matches;
        room.matchSeq = built.seq;
    } else if (format === 'mexicano') {
        // Only the opening round is fixed; later rounds follow the standings.
        const schedule = buildAmericano(playerIds, courts.length, 1, rng);
        const built = materialize(schedule, courts, 0, 0);
        room.matches = built.matches;
        room.matchSeq = built.seq;
    } else {
        const schedule = buildAmericano(playerIds, courts.length, roundsPlanned, rng);
        const built = materialize(schedule, courts, 0, 0);
        room.matches = built.matches;
        room.matchSeq = built.seq;
    }

    return room;
}

export function clampRounds(value) {
    const n = Math.round(Number(value) || 0);
    return Math.min(MAX_ROUNDS, Math.max(MIN_ROUNDS, n));
}

/* ===== mexicano progression ===== */

function statsFromMatches(room) {
    const stats = emptyStats(room.players.map(p => p.id));

    for (const match of room.matches) {
        if (match.status !== 'done') continue;
        stats.partner[pairKey(match.a[0], match.a[1])] =
            partnerCount(stats, match.a[0], match.a[1]) + 1;
        stats.partner[pairKey(match.b[0], match.b[1])] =
            partnerCount(stats, match.b[0], match.b[1]) + 1;
        for (const a of match.a) {
            for (const b of match.b) {
                stats.opponent[pairKey(a, b)] = opponentCount(stats, a, b) + 1;
            }
        }
        for (const id of [...match.a, ...match.b]) stats.games[id] += 1;
    }

    return stats;
}

function teamHistory(room) {
    if (!room.pairs) return null;
    const indexOfPair = key => room.pairs.findIndex(p => pairKey(p[0], p[1]) === key);
    const met = {};
    const games = room.pairs.map(() => 0);

    for (const match of room.matches) {
        const x = indexOfPair(pairKey(match.a[0], match.a[1]));
        const y = indexOfPair(pairKey(match.b[0], match.b[1]));
        if (x < 0 || y < 0) continue;
        const key = pairKey(String(x), String(y));
        met[key] = (met[key] || 0) + 1;
        games[x] += 1;
        games[y] += 1;
    }

    return { met, games };
}

export function roundsGenerated(room) {
    return room.matches.reduce((max, m) => Math.max(max, m.round + 1), 0);
}

export function generateMexicanoRound(room) {
    const generated = roundsGenerated(room);
    if (generated >= room.roundsPlanned) return false;
    if (room.matches.some(m => m.status !== 'done')) return false;

    const standings = computeStandings(room);
    const stats = statsFromMatches(room);
    const perRound = Math.min(
        room.courts.length,
        Math.floor(room.players.length / PLAYERS_PER_MATCH),
    );
    const needed = perRound * PLAYERS_PER_MATCH;

    // Players with the fewest games get priority, then the standings decide seeding.
    const byRest = standings
        .slice()
        .sort((x, y) => stats.games[x.playerId] - stats.games[y.playerId] || y.points - x.points);
    const activeIds = new Set(byRest.slice(0, needed).map(entry => entry.playerId));
    const ranked = standings.filter(entry => activeIds.has(entry.playerId));

    const groups = [];
    for (let i = 0; i < ranked.length; i += PLAYERS_PER_MATCH) {
        const [r1, r2, r3, r4] = ranked.slice(i, i + PLAYERS_PER_MATCH).map(e => e.playerId);
        groups.push([[r1, r4], [r2, r3]]);
    }

    const built = materialize([groups], room.courts, generated, room.matchSeq);
    room.matches = room.matches.concat(built.matches);
    room.matchSeq = built.seq;
    return true;
}

/* ===== standings ===== */

export function computeStandings(room) {
    const rows = new Map();

    for (const player of room.players) {
        rows.set(player.id, {
            playerId: player.id,
            name: player.name,
            played: 0,
            points: 0,
            against: 0,
            diff: 0,
            wins: 0,
            draws: 0,
            losses: 0,
        });
    }

    for (const match of room.matches) {
        if (match.status !== 'done') continue;
        const scoreA = Number(match.scoreA) || 0;
        const scoreB = Number(match.scoreB) || 0;

        const sides = [
            { team: match.a, scored: scoreA, conceded: scoreB },
            { team: match.b, scored: scoreB, conceded: scoreA },
        ];

        for (const side of sides) {
            for (const id of side.team) {
                const row = rows.get(id);
                if (!row) continue;
                row.played += 1;
                row.points += side.scored;
                row.against += side.conceded;
                row.diff = row.points - row.against;
                if (side.scored > side.conceded) row.wins += 1;
                else if (side.scored < side.conceded) row.losses += 1;
                else row.draws += 1;
            }
        }
    }

    return [...rows.values()].sort((x, y) =>
        y.points - x.points ||
        y.diff - x.diff ||
        y.wins - x.wins ||
        x.name.localeCompare(y.name)
    );
}

export function computePairStandings(room) {
    if (!room.pairs) return [];
    const nameOf = id => room.players.find(p => p.id === id)?.name || id;

    return room.pairs
        .map((pair, index) => {
            const key = pairKey(pair[0], pair[1]);
            let played = 0;
            let points = 0;
            let against = 0;
            let wins = 0;

            for (const match of room.matches) {
                if (match.status !== 'done') continue;
                const isA = pairKey(match.a[0], match.a[1]) === key;
                const isB = pairKey(match.b[0], match.b[1]) === key;
                if (!isA && !isB) continue;

                const scored = Number(isA ? match.scoreA : match.scoreB) || 0;
                const conceded = Number(isA ? match.scoreB : match.scoreA) || 0;
                played += 1;
                points += scored;
                against += conceded;
                if (scored > conceded) wins += 1;
            }

            return {
                pairIndex: index,
                players: pair,
                name: pair.map(nameOf).join(' & '),
                played,
                points,
                against,
                diff: points - against,
                wins,
            };
        })
        .sort((x, y) => y.points - x.points || y.diff - x.diff || y.wins - x.wins);
}

/* ===== live board ===== */

const matchOrder = (x, y) => x.round - y.round || x.id.localeCompare(y.id, undefined, { numeric: true });

function combinations(list, size) {
    const out = [];
    const walk = (start, picked) => {
        if (picked.length === size) {
            out.push(picked.slice());
            return;
        }
        for (let i = start; i < list.length; i++) {
            picked.push(list[i]);
            walk(i + 1, picked);
            picked.pop();
        }
    };
    walk(0, []);
    return out;
}

const FILLER_POOL_LIMIT = 8;

/**
 * Suggests a four for an idle court when no queued match fits — the case where
 * a group finishes and the players left over are not a planned foursome.
 * Deterministic, so every phone in the room proposes the same game.
 */
export function proposeFiller(room, freeIds) {
    if (freeIds.length < PLAYERS_PER_MATCH) return null;

    const stats = statsFromMatches(room);
    const pool = freeIds
        .slice()
        .sort((x, y) => stats.games[x] - stats.games[y] || x.localeCompare(y, undefined, { numeric: true }))
        .slice(0, FILLER_POOL_LIMIT);

    let best = null;
    let bestCost = Infinity;

    for (const group of combinations(pool, PLAYERS_PER_MATCH)) {
        const split = bestSplit(stats, group);
        const load = group.reduce((sum, id) => sum + stats.games[id], 0);
        const cost = split.cost + load * 3;
        if (cost < bestCost) {
            bestCost = cost;
            best = split.teams;
        }
    }

    return best ? { a: best[0], b: best[1] } : null;
}

/**
 * Works out what is happening on every court right now and, for the free ones,
 * the earliest queued match whose four players are all off court. This is what
 * lets a finished court start its next game without waiting for the others.
 */
export function planBoard(room) {
    const busy = new Set();
    for (const match of room.matches) {
        if (match.status !== 'live') continue;
        for (const id of [...match.a, ...match.b]) busy.add(id);
    }

    const pending = room.matches.filter(m => m.status === 'pending').sort(matchOrder);
    const reserved = new Set();
    const byCourt = [];

    for (const court of room.courts) {
        const live = room.matches.find(m => m.status === 'live' && m.court === court.id) || null;
        let next = null;
        let filler = null;

        if (!live) {
            next = pending.find(match =>
                !reserved.has(match.id) &&
                [...match.a, ...match.b].every(id => !busy.has(id))
            ) || null;

            if (next) {
                reserved.add(next.id);
                for (const id of [...next.a, ...next.b]) busy.add(id);
            } else if (pending.length > 0 && room.format !== 'mexicano') {
                const free = room.players.map(p => p.id).filter(id => !busy.has(id));
                filler = proposeFiller(room, free);
                if (filler) {
                    for (const id of [...filler.a, ...filler.b]) busy.add(id);
                }
            }
        }

        byCourt.push({ court, live, next, filler });
    }

    const queued = pending.filter(m => !reserved.has(m.id));
    const resting = room.players.filter(p => !busy.has(p.id)).map(p => p.id);

    return { byCourt, queued, resting, busy };
}

/* ===== actions ===== */

function findMatch(room, matchId) {
    const match = room.matches.find(m => m.id === matchId);
    if (!match) throw new Error('Match not found');
    return match;
}

function assertCourtFree(room, courtId, matchId) {
    const occupied = room.matches.find(
        m => m.status === 'live' && m.court === courtId && m.id !== matchId,
    );
    if (occupied) throw new Error('Court is busy');
}

function assertPlayersFree(room, match) {
    const busy = new Set();
    for (const other of room.matches) {
        if (other.status !== 'live' || other.id === match.id) continue;
        for (const id of [...other.a, ...other.b]) busy.add(id);
    }
    const clash = [...match.a, ...match.b].find(id => busy.has(id));
    if (clash) throw new Error('A player is already on court');
}

/**
 * Applies a single mutation in place and reports whether anything changed.
 * Both the API and offline mode call this, so the two stay in step.
 */
export function applyAction(room, action) {
    switch (action.type) {
        case 'start': {
            const match = findMatch(room, action.matchId);
            if (match.status === 'done') throw new Error('Match is already finished');
            const courtId = action.courtId || match.court;
            if (!room.courts.some(c => c.id === courtId)) throw new Error('Unknown court');
            assertCourtFree(room, courtId, match.id);
            assertPlayersFree(room, match);
            match.court = courtId;
            match.status = 'live';
            match.startedAt = Date.now();
            return true;
        }

        case 'fill': {
            const court = room.courts.find(c => c.id === action.courtId);
            if (!court) throw new Error('Unknown court');
            assertCourtFree(room, court.id, null);

            const ids = [...(action.a || []), ...(action.b || [])];
            if (ids.length !== PLAYERS_PER_MATCH) throw new Error('A filler game needs four players');
            if (new Set(ids).size !== PLAYERS_PER_MATCH) throw new Error('Duplicate player');
            if (ids.some(id => !room.players.some(p => p.id === id))) throw new Error('Unknown player');

            const match = {
                id: `m${room.matchSeq++}`,
                round: room.matches.find(m => m.status === 'pending')?.round ?? roundsGenerated(room) - 1,
                court: court.id,
                a: action.a.slice(),
                b: action.b.slice(),
                status: 'live',
                scoreA: null,
                scoreB: null,
                startedAt: Date.now(),
                endedAt: null,
                filler: true,
            };

            assertPlayersFree(room, match);
            room.matches.push(match);
            return true;
        }

        case 'cancel': {
            const match = findMatch(room, action.matchId);
            if (match.status !== 'live') return false;
            if (match.filler) {
                // Filler games only exist because a court was idle; drop it entirely.
                room.matches = room.matches.filter(m => m.id !== match.id);
                return true;
            }
            match.status = 'pending';
            match.startedAt = null;
            return true;
        }

        case 'score': {
            const match = findMatch(room, action.matchId);
            const scoreA = Math.max(0, Math.round(Number(action.scoreA) || 0));
            const scoreB = Math.max(0, Math.round(Number(action.scoreB) || 0));
            if (scoreA === 0 && scoreB === 0) throw new Error('Enter a score first');
            if (match.status !== 'live' && match.status !== 'done') {
                assertPlayersFree(room, match);
            }
            match.scoreA = scoreA;
            match.scoreB = scoreB;
            match.status = 'done';
            match.endedAt = Date.now();
            if (room.format === 'mexicano') generateMexicanoRound(room);
            return true;
        }

        case 'reopen': {
            const match = findMatch(room, action.matchId);
            if (match.status !== 'done') return false;
            // A finished mexicano round may have spawned the next one already.
            if (room.format === 'mexicano') {
                const later = roundsGenerated(room) - 1;
                if (match.round < later) {
                    const hasProgress = room.matches.some(
                        m => m.round === later && m.status !== 'pending',
                    );
                    if (hasProgress) throw new Error('The next round has already started');
                    room.matches = room.matches.filter(m => m.round !== later);
                }
            }
            match.status = 'live';
            match.scoreA = null;
            match.scoreB = null;
            match.endedAt = null;
            return true;
        }

        case 'renamePlayer': {
            const player = room.players.find(p => p.id === action.playerId);
            if (!player) throw new Error('Player not found');
            const name = String(action.name || '').trim();
            if (!name) throw new Error('Name cannot be empty');
            player.name = name.slice(0, 24);
            return true;
        }

        case 'renameCourt': {
            const court = room.courts.find(c => c.id === action.courtId);
            if (!court) throw new Error('Court not found');
            const name = String(action.name || '').trim();
            if (!name) throw new Error('Name cannot be empty');
            court.name = name.slice(0, 24);
            return true;
        }

        case 'extend': {
            const extra = Math.min(6, Math.max(1, Math.round(Number(action.rounds) || 1)));
            const generated = roundsGenerated(room);
            room.roundsPlanned = Math.min(MAX_ROUNDS, room.roundsPlanned + extra);

            if (room.format === 'mexicano') {
                generateMexicanoRound(room);
                return true;
            }

            const rng = mulberry32((room.seed || 1) + generated * 7919 + extra);
            const stats = statsFromMatches(room);
            for (const match of room.matches) {
                if (match.status === 'done') continue;
                stats.partner[pairKey(match.a[0], match.a[1])] =
                    partnerCount(stats, match.a[0], match.a[1]) + 1;
                stats.partner[pairKey(match.b[0], match.b[1])] =
                    partnerCount(stats, match.b[0], match.b[1]) + 1;
                for (const a of match.a) {
                    for (const b of match.b) {
                        stats.opponent[pairKey(a, b)] = opponentCount(stats, a, b) + 1;
                    }
                }
                for (const id of [...match.a, ...match.b]) stats.games[id] += 1;
            }

            const schedule = [];
            if (room.format === 'teamAmericano') {
                schedule.push(
                    ...buildTeamAmericano(
                        room.pairs,
                        room.courts.length,
                        extra,
                        rng,
                        teamHistory(room),
                    ),
                );
            } else {
                const playerIds = room.players.map(p => p.id);
                const perRound = Math.min(
                    room.courts.length,
                    Math.floor(playerIds.length / PLAYERS_PER_MATCH),
                );
                for (let round = 0; round < extra; round++) {
                    const active = pickActive(playerIds, stats, perRound * PLAYERS_PER_MATCH, rng);
                    const groups = arrangeGroups(active, stats, rng);
                    commitRound(groups, stats, playerIds);
                    schedule.push(groups);
                }
            }

            const built = materialize(schedule, room.courts, generated, room.matchSeq);
            room.matches = room.matches.concat(built.matches);
            room.matchSeq = built.seq;
            return true;
        }

        default:
            throw new Error(`Unknown action: ${action.type}`);
    }
}
