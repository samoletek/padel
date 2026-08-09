import { useTranslation } from '../i18n';
import { PLAYER_COUNTS, maxCourtsFor } from '../../shared/engine.js';

export default function PlayersStep({ value, onChange, onNext, onBack }) {
    const { t } = useTranslation();
    const l = t.players;

    return (
        <div className="setup-step step-enter">
            <h2>{l.title}</h2>
            <p className="step-subtitle">{l.subtitle}</p>

            <div className="count-grid">
                {PLAYER_COUNTS.map(count => (
                    <button
                        key={count}
                        type="button"
                        className={`count-option ${value === count ? 'selected' : ''}`}
                        onClick={() => onChange(count)}
                    >
                        {count}
                    </button>
                ))}
            </div>

            <p className="count-info">{l.info(value, maxCourtsFor(value))}</p>

            <div className="step-buttons">
                <button className="btn btn-ghost" onClick={onBack}>{t.common.back}</button>
                <button className="btn btn-primary" onClick={onNext}>{t.common.next}</button>
            </div>
        </div>
    );
}
