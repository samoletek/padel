import { useState } from 'react';
import { useTranslation } from '../i18n';

function elapsedLabel(startedAt, now) {
    if (!startedAt) return null;
    const minutes = Math.max(0, Math.floor((now - startedAt) / 60000));
    return minutes < 60
        ? `${minutes}′`
        : `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}′`;
}

function Side({ ids, nameOf, me, score }) {
    return (
        <div className="side">
            <div className="side-names">
                {ids.map(id => (
                    <span key={id} className={`side-name ${id === me ? 'is-me' : ''}`}>
                        {nameOf(id)}
                    </span>
                ))}
            </div>
            {score !== undefined && score !== null && <div className="side-score">{score}</div>}
        </div>
    );
}

export function Matchup({ match, nameOf, me, showScore }) {
    const { t } = useTranslation();
    return (
        <div className="matchup">
            <Side ids={match.a} nameOf={nameOf} me={me} score={showScore ? match.scoreA : undefined} />
            <div className="matchup-vs">{t.room.vs}</div>
            <Side ids={match.b} nameOf={nameOf} me={me} score={showScore ? match.scoreB : undefined} />
        </div>
    );
}

function CourtCard({ slot, nameOf, me, now, nothingLeft, onStart, onFill, onScore, onCancel }) {
    const { t } = useTranslation();
    const l = t.room;
    const { court, live, next, filler } = slot;
    const [showExtra, setShowExtra] = useState(false);

    const upcoming = live || next;
    const mine = upcoming && [...upcoming.a, ...upcoming.b].includes(me);

    return (
        <section className={`court-card ${live ? 'is-live' : ''} ${mine ? 'is-mine' : ''}`}>
            <header className="court-card-header">
                <div className="court-name">{court.name}</div>
                {live ? (
                    <div className="court-status status-live">
                        <span className="pulse-dot" />
                        {elapsedLabel(live.startedAt, now) || l.statusLive}
                    </div>
                ) : (
                    <div className="court-status">{next ? l.queuedNext : l.idle}</div>
                )}
            </header>

            {live && (
                <>
                    <Matchup match={live} nameOf={nameOf} me={me} />
                    <div className="court-actions">
                        <button className="btn btn-primary btn-block" onClick={() => onScore(live)}>
                            {l.enterScore}
                        </button>
                        <button className="btn btn-ghost btn-small" onClick={() => onCancel(live.id)}>
                            {l.stop}
                        </button>
                    </div>
                </>
            )}

            {!live && next && (
                <>
                    <Matchup match={next} nameOf={nameOf} me={me} />
                    <div className="court-meta">{l.plannedRound(next.round + 1)}</div>
                    <div className="court-actions">
                        <button
                            className="btn btn-primary btn-block"
                            onClick={() => onStart(next.id, court.id)}
                        >
                            {l.startHere}
                        </button>
                    </div>
                </>
            )}

            {!live && !next && (
                <>
                    <div className="court-empty">{nothingLeft ? l.finished : l.idleWaiting}</div>

                    {/* Off-plan games stay behind a deliberate tap: offering one every
                        time a court frees up would quietly replace the schedule. */}
                    {filler && !showExtra && (
                        <div className="court-actions">
                            <button
                                className="btn btn-ghost btn-small"
                                onClick={() => setShowExtra(true)}
                            >
                                {l.offerExtra}
                            </button>
                        </div>
                    )}

                    {filler && showExtra && (
                        <>
                            <Matchup match={filler} nameOf={nameOf} me={me} />
                            <div className="court-meta">
                                <span className="badge badge-filler">{l.fillerBadge}</span>
                                {l.fillerHint}
                            </div>
                            <div className="court-actions">
                                <button
                                    className="btn btn-secondary btn-block"
                                    onClick={() => onFill(court.id, filler)}
                                >
                                    {l.startHere}
                                </button>
                                <button
                                    className="btn btn-ghost btn-small"
                                    onClick={() => setShowExtra(false)}
                                >
                                    {t.common.cancel}
                                </button>
                            </div>
                        </>
                    )}
                </>
            )}
        </section>
    );
}

export default function LiveBoard({
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

    const pendingLeft = room.matches.filter(match => match.status === 'pending').length;
    const nothingLeft = pendingLeft === 0 && !room.matches.some(match => match.status === 'live');

    return (
        <div className="live-board">
            {board.byCourt.map(slot => (
                <CourtCard
                    key={slot.court.id}
                    slot={slot}
                    nameOf={nameOf}
                    me={me}
                    now={now}
                    nothingLeft={nothingLeft}
                    onStart={onStart}
                    onFill={onFill}
                    onScore={onScore}
                    onCancel={onCancel}
                />
            ))}

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
                    <div className="board-progress">{l.gamesLeft(pendingLeft)}</div>
                )}
            </div>
        </div>
    );
}
