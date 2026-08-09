import { useTranslation } from '../i18n';
import { Matchup } from './LiveBoard';

export default function ScheduleBoard({ room, me, onScore }) {
    const { t } = useTranslation();
    const l = t.room;
    const nameOf = id => room.players.find(player => player.id === id)?.name || id;
    const courtName = id => room.courts.find(court => court.id === id)?.name || id;

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

    const statusLabel = status =>
        status === 'done' ? l.statusDone : status === 'live' ? l.statusLive : l.statusPending;

    const renderMatch = match => {
        const mine = [...match.a, ...match.b].includes(me);
        return (
            <button
                key={match.id}
                type="button"
                className={`schedule-match status-${match.status} ${mine ? 'is-mine' : ''}`}
                onClick={() => onScore(match)}
            >
                <div className="schedule-match-head">
                    <span className="schedule-court">{courtName(match.court)}</span>
                    <span className={`schedule-status status-${match.status}`}>
                        {statusLabel(match.status)}
                    </span>
                </div>
                <Matchup match={match} nameOf={nameOf} me={me} showScore={match.status === 'done'} />
            </button>
        );
    };

    return (
        <div className="schedule-board">
            {groups.map(([round, matches]) => (
                <section className="schedule-round" key={round}>
                    <h3 className="schedule-round-title">{l.roundLabel(round + 1)}</h3>
                    <div className="schedule-round-matches">{matches.map(renderMatch)}</div>
                </section>
            ))}

            {extras.length > 0 && (
                <section className="schedule-round">
                    <h3 className="schedule-round-title">{l.extraGames}</h3>
                    <div className="schedule-round-matches">{extras.map(renderMatch)}</div>
                </section>
            )}
        </div>
    );
}
