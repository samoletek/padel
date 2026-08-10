import { useState } from 'react';
import { useTranslation } from '../i18n';
import Matchup from './Matchup';

/**
 * The whole session in one list: finished games keep their score, the game on
 * court carries the controls, and everything still queued sits dimmed below.
 */
export default function GamesBoard({
    room,
    board,
    me,
    now,
    onStart,
    onFill,
    onScore,
    onCancel,
    onExtend,
}) {
    const { t } = useTranslation();
    const l = t.room;

    const nameOf = id => room.players.find(player => player.id === id)?.name || id;
    const courtName = id => room.courts.find(court => court.id === id)?.name || id;

    // Which queued game can start right now, and on which court.
    const startableCourt = new Map();
    for (const slot of board.byCourt) {
        if (slot.next) startableCourt.set(slot.next.id, slot.court);
    }
    const idleCourts = board.byCourt.filter(slot => !slot.live && !slot.next);

    const pendingLeft = room.matches.filter(match => match.status === 'pending').length;
    const playedCount = room.matches.filter(match => match.status === 'done').length;
    const nothingLeft = pendingLeft === 0 && !room.matches.some(match => match.status === 'live');

    const rounds = new Map();
    const extras = [];
    for (const match of room.matches) {
        if (match.filler) {
            extras.push(match);
            continue;
        }
        if (!rounds.has(match.round)) rounds.set(match.round, []);
        rounds.get(match.round).push(match);
    }
    const groups = [...rounds.entries()].sort((x, y) => x[0] - y[0]);

    const renderMatch = match => {
        const court = startableCourt.get(match.id);
        const mine = [...match.a, ...match.b].includes(me);

        return (
            <article
                key={match.id}
                className={`game-card status-${match.status} ${court ? 'is-next' : ''} ${mine ? 'is-mine' : ''}`}
            >
                <header className="game-card-head">
                    <span className="game-court">{courtName(match.court)}</span>
                    {match.filler && <span className="badge badge-filler">{l.fillerBadge}</span>}
                </header>

                <Matchup match={match} nameOf={nameOf} me={me} now={now} />

                {match.status === 'live' && (
                    <div className="game-actions">
                        <button className="btn btn-primary btn-block" onClick={() => onScore(match)}>
                            {l.enterScore}
                        </button>
                        <button className="btn btn-ghost btn-small" onClick={() => onCancel(match.id)}>
                            {l.stop}
                        </button>
                    </div>
                )}

                {match.status === 'pending' && court && (
                    <div className="game-actions">
                        <button
                            className="btn btn-primary btn-block"
                            onClick={() => onStart(match.id, court.id)}
                        >
                            {court.id === match.court ? l.startHere : `${l.start} — ${court.name}`}
                        </button>
                    </div>
                )}

                {match.status === 'done' && (
                    <div className="game-actions">
                        <button className="btn btn-ghost btn-small" onClick={() => onScore(match)}>
                            {l.editScore}
                        </button>
                    </div>
                )}
            </article>
        );
    };

    return (
        <div className="games-board">
            {idleCourts.length > 0 && !nothingLeft && (
                <div className="idle-strip">
                    {idleCourts.map(slot => (
                        <IdleCourt
                            key={slot.court.id}
                            slot={slot}
                            nameOf={nameOf}
                            me={me}
                            onFill={onFill}
                        />
                    ))}
                </div>
            )}

            {groups.map(([round, matches]) => (
                <section className="game-round" key={round}>
                    <h3 className="game-round-title">{l.roundLabel(round + 1)}</h3>
                    <div className="game-round-list">{matches.map(renderMatch)}</div>
                </section>
            ))}

            {extras.length > 0 && (
                <section className="game-round">
                    <h3 className="game-round-title">{l.extraGames}</h3>
                    <div className="game-round-list">{extras.map(renderMatch)}</div>
                </section>
            )}

            <div className="board-footer">
                <div className="resting">
                    <span className="resting-label">{l.restingNow}</span>
                    {board.resting.length === 0 ? (
                        <span className="resting-empty">{l.nobodyResting}</span>
                    ) : (
                        <div className="resting-chips">
                            {board.resting.map(id => (
                                <span key={id} className={`chip ${id === me ? 'is-me' : ''}`}>
                                    {nameOf(id)}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {nothingLeft ? (
                    <div className="board-finished">
                        <span>{l.finishedHint}</span>
                        <button className="btn btn-secondary btn-small" onClick={onExtend}>
                            {l.addRounds}
                        </button>
                    </div>
                ) : (
                    <div className="board-progress">
                        {room.endless ? l.played(playedCount) : l.gamesLeft(pendingLeft)}
                    </div>
                )}
            </div>
        </div>
    );
}

function IdleCourt({ slot, nameOf, me, onFill }) {
    const { t } = useTranslation();
    const l = t.room;
    const [showExtra, setShowExtra] = useState(false);
    const { court, filler } = slot;

    return (
        <div className="idle-court">
            <div className="idle-court-head">
                <span className="idle-court-name">{l.courtFree(court.name)}</span>
                {filler && !showExtra && (
                    <button type="button" className="chip-button" onClick={() => setShowExtra(true)}>
                        {l.offerExtra}
                    </button>
                )}
            </div>

            {!filler && <span className="idle-court-note">{l.idleWaiting}</span>}

            {filler && showExtra && (
                <>
                    <Matchup match={{ ...filler, status: 'pending' }} nameOf={nameOf} me={me} />
                    <span className="idle-court-note">{l.fillerHint}</span>
                    <div className="game-actions">
                        <button
                            className="btn btn-secondary btn-block"
                            onClick={() => onFill(court.id, filler)}
                        >
                            {l.startHere}
                        </button>
                        <button className="btn btn-ghost btn-small" onClick={() => setShowExtra(false)}>
                            {t.common.cancel}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
