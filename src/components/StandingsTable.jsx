import { useTranslation } from '../i18n';
import { computeStandings, computePairStandings } from '../../shared/engine.js';

export default function StandingsTable({ room, me }) {
    const { t } = useTranslation();
    const l = t.room;

    const players = computeStandings(room);
    const pairs = room.format === 'teamAmericano' ? computePairStandings(room) : [];
    const anyPlayed = players.some(row => row.played > 0);

    if (!anyPlayed) {
        return <div className="panel panel-muted">{l.emptyTable}</div>;
    }

    return (
        <div className="standings">
            {pairs.length > 0 && (
                <section className="panel">
                    <h3 className="panel-title">{l.pairStandings}</h3>
                    <Table
                        rows={pairs.map((row, index) => ({
                            key: `pair-${row.pairIndex}`,
                            rank: index + 1,
                            name: row.name,
                            played: row.played,
                            points: row.points,
                            diff: row.diff,
                            wins: row.wins,
                            highlight: row.players.includes(me),
                        }))}
                        labels={l}
                    />
                </section>
            )}

            <section className="panel">
                <h3 className="panel-title">{l.playerStandings}</h3>
                <Table
                    rows={players.map((row, index) => ({
                        key: row.playerId,
                        rank: index + 1,
                        name: row.name,
                        played: row.played,
                        points: row.points,
                        diff: row.diff,
                        wins: row.wins,
                        highlight: row.playerId === me,
                    }))}
                    labels={l}
                />
            </section>
        </div>
    );
}

function Table({ rows, labels }) {
    return (
        <div className="table-scroll">
            <table className="standings-table">
                <thead>
                    <tr>
                        <th className="col-rank">{labels.colRank}</th>
                        <th className="col-name">{labels.colName}</th>
                        <th>{labels.colPlayed}</th>
                        <th>{labels.colWins}</th>
                        <th>{labels.colDiff}</th>
                        <th className="col-points">{labels.colPoints}</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(row => (
                        <tr key={row.key} className={row.highlight ? 'is-me' : ''}>
                            <td className="col-rank">{row.rank}</td>
                            <td className="col-name">{row.name}</td>
                            <td>{row.played}</td>
                            <td>{row.wins}</td>
                            <td className={row.diff > 0 ? 'positive' : row.diff < 0 ? 'negative' : ''}>
                                {row.diff > 0 ? `+${row.diff}` : row.diff}
                            </td>
                            <td className="col-points">{row.points}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
