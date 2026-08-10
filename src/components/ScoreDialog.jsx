import { useState } from 'react';
import { useTranslation } from '../i18n';
import Modal from './Modal';

export default function ScoreDialog({ room, match, me, onSubmit, onReopen, onClose }) {
    const { t } = useTranslation();
    const l = t.room;
    const target = room.pointsPerMatch;

    const [scoreA, setScoreA] = useState(match.scoreA ?? Math.ceil(target / 2));
    const [scoreB, setScoreB] = useState(match.scoreB ?? Math.floor(target / 2));
    const [saving, setSaving] = useState(false);

    const nameOf = id => room.players.find(player => player.id === id)?.name || id;
    const total = scoreA + scoreB;

    const setSplit = value => {
        const a = Math.min(target, Math.max(0, value));
        setScoreA(a);
        setScoreB(target - a);
    };

    const nudge = (side, delta) => {
        if (side === 'a') setScoreA(current => Math.max(0, current + delta));
        else setScoreB(current => Math.max(0, current + delta));
    };

    const submit = async () => {
        setSaving(true);
        const ok = await onSubmit(match.id, scoreA, scoreB);
        setSaving(false);
        if (ok) onClose();
    };

    return (
        <Modal
            title={l.scoreTitle}
            kicker={room.courts.find(court => court.id === match.court)?.name}
            onClose={onClose}
        >
            <p className="modal-intro">{l.scoreHint(target)}</p>

            <div className="score-editor">
                <ScoreSide
                    names={match.a.map(nameOf)}
                    highlight={match.a.includes(me)}
                    value={scoreA}
                    onNudge={delta => nudge('a', delta)}
                />
                <div className="score-divider">vs</div>
                <ScoreSide
                    names={match.b.map(nameOf)}
                    highlight={match.b.includes(me)}
                    value={scoreB}
                    onNudge={delta => nudge('b', delta)}
                />
            </div>

            <input
                className="score-slider"
                type="range"
                min={0}
                max={target}
                value={Math.min(scoreA, target)}
                onChange={event => setSplit(Number(event.target.value))}
                aria-label={l.scoreTitle}
            />

            <div className={`score-total ${total === target ? '' : 'is-off'}`}>
                {l.scoreTotal(total, target)}
            </div>
            {total !== target && <p className="field-hint">{l.scoreMismatch}</p>}

            <div className="modal-actions">
                {match.status === 'done' && (
                    <button
                        className="btn btn-ghost"
                        onClick={async () => {
                            const ok = await onReopen(match.id);
                            if (ok) onClose();
                        }}
                    >
                        {l.reopen}
                    </button>
                )}
                <button className="btn btn-primary" onClick={submit} disabled={saving}>
                    {l.scoreSave}
                </button>
            </div>
        </Modal>
    );
}

function ScoreSide({ names, highlight, value, onNudge }) {
    return (
        <div className={`score-side ${highlight ? 'is-mine' : ''}`}>
            <div className="score-side-names">
                {names.map(name => (
                    <span key={name}>{name}</span>
                ))}
            </div>
            <div className="score-control">
                <button type="button" className="stepper-button" onClick={() => onNudge(-1)} aria-label="-1">
                    −
                </button>
                <span className="score-value">{value}</span>
                <button type="button" className="stepper-button" onClick={() => onNudge(1)} aria-label="+1">
                    +
                </button>
            </div>
        </div>
    );
}
