import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../i18n';
import { planBoard } from '../../shared/engine.js';
import { loadIdentity, saveIdentity } from '../lib/storage';
import LiveBoard from './LiveBoard';
import ScheduleBoard from './ScheduleBoard';
import StandingsTable from './StandingsTable';
import ScoreDialog from './ScoreDialog';
import ShareDialog from './ShareDialog';
import Modal from './Modal';

const TABS = ['now', 'schedule', 'table'];
const CLOCK_INTERVAL_MS = 30000;

export default function RoomView({ room, connection, act, actionError, dismissError, onLeave }) {
    const { t } = useTranslation();
    const l = t.room;

    const [tab, setTab] = useState('now');
    const [me, setMe] = useState(() => loadIdentity(room.code));
    const [scoreMatch, setScoreMatch] = useState(null);
    const [showShare, setShowShare] = useState(false);
    const [showIdentity, setShowIdentity] = useState(false);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), CLOCK_INTERVAL_MS);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!actionError) return undefined;
        const timer = setTimeout(dismissError, 4000);
        return () => clearTimeout(timer);
    }, [actionError, dismissError]);

    const board = useMemo(() => planBoard(room), [room]);
    const isLocal = connection === 'local';
    const shareUrl = `${window.location.origin}/#/r/${room.code}`;

    const chooseIdentity = playerId => {
        setMe(playerId);
        saveIdentity(room.code, playerId);
        setShowIdentity(false);
    };

    const myName = room.players.find(player => player.id === me)?.name;

    const myStatus = useMemo(() => {
        if (!me) return null;
        for (const slot of board.byCourt) {
            if (slot.live && [...slot.live.a, ...slot.live.b].includes(me)) {
                return { kind: 'live', text: l.yourGameLive(slot.court.name) };
            }
        }
        for (const slot of board.byCourt) {
            const upcoming = slot.next || slot.filler;
            if (upcoming && [...upcoming.a, ...upcoming.b].includes(me)) {
                return { kind: 'next', text: l.yourNextOn(slot.court.name) };
            }
        }
        return { kind: 'rest', text: l.yourRest };
    }, [board, me, l]);

    const openScore = match => setScoreMatch(match);

    // The dialog holds a match snapshot; refresh it from the live room each render.
    const activeMatch = scoreMatch
        ? room.matches.find(match => match.id === scoreMatch.id) || null
        : null;

    return (
        <div className="room step-enter">
            <header className="room-header">
                <button
                    type="button"
                    className={`room-code ${isLocal ? 'is-local' : ''}`}
                    onClick={() => !isLocal && setShowShare(true)}
                    disabled={isLocal}
                >
                    <span className="room-code-label">{isLocal ? l.localOnly : l.codeLabel}</span>
                    {!isLocal && <span className="room-code-value">{room.code}</span>}
                </button>

                <div className="room-header-right">
                    <ConnectionBadge connection={connection} labels={l} common={t.common} />
                    {!isLocal && (
                        <button className="btn btn-secondary btn-small" onClick={() => setShowShare(true)}>
                            {l.shareButton}
                        </button>
                    )}
                </div>
            </header>

            <div className="room-identity">
                <button type="button" className="identity-button" onClick={() => setShowIdentity(true)}>
                    {myName ? (
                        <>
                            <span className="identity-dot" />
                            {myName}
                        </>
                    ) : (
                        l.whoAreYou
                    )}
                </button>
                {myStatus && <span className={`identity-status is-${myStatus.kind}`}>{myStatus.text}</span>}
            </div>

            <nav className="room-tabs">
                {TABS.map(key => (
                    <button
                        key={key}
                        type="button"
                        className={`room-tab ${tab === key ? 'active' : ''}`}
                        onClick={() => setTab(key)}
                    >
                        {key === 'now' ? l.tabNow : key === 'schedule' ? l.tabSchedule : l.tabTable}
                    </button>
                ))}
            </nav>

            {actionError && <div className="error-banner room-error">{actionError}</div>}

            {tab === 'now' && (
                <LiveBoard
                    room={room}
                    board={board}
                    me={me}
                    now={now}
                    onStart={(matchId, courtId) => act({ type: 'start', matchId, courtId })}
                    onFill={(courtId, filler) =>
                        act({ type: 'fill', courtId, a: filler.a, b: filler.b })
                    }
                    onScore={openScore}
                    onCancel={matchId => act({ type: 'cancel', matchId })}
                    onExtend={() => act({ type: 'extend', rounds: 2 })}
                />
            )}

            {tab === 'schedule' && <ScheduleBoard room={room} me={me} onScore={openScore} />}
            {tab === 'table' && <StandingsTable room={room} me={me} />}

            <div className="room-footer">
                <button className="btn btn-ghost btn-small" onClick={onLeave}>
                    {l.leave}
                </button>
            </div>

            {activeMatch && (
                <ScoreDialog
                    room={room}
                    match={activeMatch}
                    me={me}
                    onSubmit={(matchId, scoreA, scoreB) => act({ type: 'score', matchId, scoreA, scoreB })}
                    onReopen={matchId => act({ type: 'reopen', matchId })}
                    onClose={() => setScoreMatch(null)}
                />
            )}

            {showShare && !isLocal && (
                <ShareDialog code={room.code} url={shareUrl} onClose={() => setShowShare(false)} />
            )}

            {showIdentity && (
                <Modal title={l.whoAreYou} onClose={() => setShowIdentity(false)}>
                    <p className="modal-intro">{l.whoAreYouHint}</p>
                    <div className="identity-grid">
                        {room.players.map(player => (
                            <button
                                key={player.id}
                                type="button"
                                className={`chip-button ${player.id === me ? 'selected' : ''}`}
                                onClick={() => chooseIdentity(player.id)}
                            >
                                {player.name}
                            </button>
                        ))}
                        <button
                            type="button"
                            className={`chip-button ${!me ? 'selected' : ''}`}
                            onClick={() => chooseIdentity(null)}
                        >
                            {l.notPlaying}
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
}

function ConnectionBadge({ connection, labels, common }) {
    if (connection === 'local') {
        return <span className="conn-badge is-local">{common.offline}</span>;
    }
    if (connection === 'offline' || connection === 'missing') {
        return <span className="conn-badge is-off">{labels.syncError}</span>;
    }
    return (
        <span className="conn-badge is-live">
            <span className="pulse-dot" />
            {common.live}
        </span>
    );
}
