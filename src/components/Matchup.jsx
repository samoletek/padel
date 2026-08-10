import { useTranslation } from '../i18n';

export function elapsedLabel(startedAt, now) {
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

/**
 * The middle column doubles as the status: "vs" before a game, the running
 * clock while it is on, and "finished" once a score is in.
 */
export default function Matchup({ match, nameOf, me, now }) {
    const { t } = useTranslation();
    const done = match.status === 'done';

    const middle = done
        ? <span className="matchup-state is-done">{t.room.finishedMatch}</span>
        : match.status === 'live'
            ? <span className="matchup-state is-live">{elapsedLabel(match.startedAt, now) || '0′'}</span>
            : <span className="matchup-vs">vs</span>;

    return (
        <div className="matchup">
            <Side ids={match.a} nameOf={nameOf} me={me} score={done ? match.scoreA : undefined} />
            <div className="matchup-middle">{middle}</div>
            <Side ids={match.b} nameOf={nameOf} me={me} score={done ? match.scoreB : undefined} />
        </div>
    );
}
