import { useTranslation } from '../i18n';
import {
    courtOptionsFor,
    maxCourtsFor,
    POINT_OPTIONS,
    MIN_ROUNDS,
    MAX_ROUNDS,
    PLAYERS_PER_MATCH,
} from '../../shared/engine.js';

export default function CourtsStep({
    playerCount,
    courtCount,
    courtNames,
    rounds,
    endless,
    pointsPerMatch,
    onCourtCountChange,
    onCourtNamesChange,
    onRoundsChange,
    onEndlessChange,
    onPointsChange,
    onCreate,
    onBack,
    offline,
    error,
}) {
    const { t } = useTranslation();
    const l = t.courts;
    const options = courtOptionsFor(playerCount);
    const perRound = Math.min(courtCount, Math.floor(playerCount / PLAYERS_PER_MATCH));
    const gamesEach = Math.round((rounds * perRound * PLAYERS_PER_MATCH) / playerCount);

    const setCourtName = (index, value) => {
        const next = courtNames.slice();
        next[index] = value;
        onCourtNamesChange(next);
    };

    return (
        <div className="setup-step step-enter">
            <h2>{l.title}</h2>
            <p className="step-subtitle">{l.subtitle}</p>

            <div className="field-block">
                <div className="field-label">{l.countLabel}</div>
                <div className="count-grid count-grid-tight">
                    {options.map(count => (
                        <button
                            key={count}
                            type="button"
                            className={`count-option count-option-sm ${courtCount === count ? 'selected' : ''}`}
                            onClick={() => onCourtCountChange(count)}
                        >
                            {count}
                        </button>
                    ))}
                </div>
                <p className="field-hint">{l.countHint(maxCourtsFor(playerCount))}</p>
            </div>

            {courtCount > 1 ? (
                <div className="field-block">
                    <div className="field-label">{l.namesLabel}</div>
                    <div
                        className="court-names"
                        style={{ '--court-cols': courtCount <= 3 ? courtCount : courtCount === 4 ? 2 : 3 }}
                    >
                        {Array.from({ length: courtCount }, (_, index) => (
                            <input
                                key={index}
                                className="name-input"
                                value={courtNames[index] ?? ''}
                                maxLength={24}
                                placeholder={l.namePlaceholder(index + 1)}
                                autoComplete="off"
                                onChange={event => setCourtName(index, event.target.value)}
                            />
                        ))}
                    </div>
                    <p className="field-hint">{l.namesHint}</p>
                </div>
            ) : (
                <p className="field-hint field-hint-standalone">{l.singleCourt}</p>
            )}

            <div className="field-row">
                <div className="field-block">
                    <div className="field-label">{l.lengthLabel}</div>
                    <div className="segmented">
                        <button
                            type="button"
                            className={`segmented-item ${endless ? 'selected' : ''}`}
                            onClick={() => onEndlessChange(true)}
                        >
                            {l.lengthEndless}
                        </button>
                        <button
                            type="button"
                            className={`segmented-item ${endless ? '' : 'selected'}`}
                            onClick={() => onEndlessChange(false)}
                        >
                            {l.lengthFixed}
                        </button>
                    </div>

                    {!endless && (
                        <div className="stepper stepper-spaced">
                            <button
                                type="button"
                                className="stepper-button"
                                onClick={() => onRoundsChange(Math.max(MIN_ROUNDS, rounds - 1))}
                                disabled={rounds <= MIN_ROUNDS}
                                aria-label="-1"
                            >
                                −
                            </button>
                            <span className="stepper-value">{rounds}</span>
                            <button
                                type="button"
                                className="stepper-button"
                                onClick={() => onRoundsChange(Math.min(MAX_ROUNDS, rounds + 1))}
                                disabled={rounds >= MAX_ROUNDS}
                                aria-label="+1"
                            >
                                +
                            </button>
                        </div>
                    )}

                    <p className="field-hint">
                        {endless ? l.endlessHint : l.roundsHint(rounds, gamesEach)}
                    </p>
                </div>

                <div className="field-block">
                    <div className="field-label">{l.pointsLabel}</div>
                    <div className="segmented">
                        {POINT_OPTIONS.map(points => (
                            <button
                                key={points}
                                type="button"
                                className={`segmented-item ${pointsPerMatch === points ? 'selected' : ''}`}
                                onClick={() => onPointsChange(points)}
                            >
                                {points}
                            </button>
                        ))}
                    </div>
                    <p className="field-hint">{l.pointsHint}</p>
                </div>
            </div>

            {offline && <div className="warning-banner">{l.offlineNotice}</div>}
            {error && <div className="error-banner">{error}</div>}

            <div className="step-buttons">
                <button className="btn btn-ghost" onClick={onBack}>{t.common.back}</button>
                <button className="btn btn-primary" onClick={onCreate}>{l.create}</button>
            </div>
        </div>
    );
}
