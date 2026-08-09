import { useTranslation } from '../i18n';

export default function FormatStep({ value, onChange, onNext, onBack }) {
    const { t } = useTranslation();
    const l = t.format;
    const selected = l.options.find(option => option.id === value) || l.options[0];

    return (
        <div className="setup-step step-enter">
            <h2>{l.title}</h2>
            <p className="step-subtitle">{l.subtitle}</p>

            <div className="format-options">
                {l.options.map(option => (
                    <button
                        key={option.id}
                        type="button"
                        className={`format-option ${value === option.id ? 'selected' : ''}`}
                        onClick={() => onChange(option.id)}
                    >
                        <span className="format-option-title">{option.label}</span>
                        <span className="format-option-desc">{option.desc}</span>
                    </button>
                ))}
            </div>

            <p className="format-detail">{selected.detail}</p>

            <div className="step-buttons">
                <button className="btn btn-ghost" onClick={onBack}>{t.common.back}</button>
                <button className="btn btn-primary" onClick={onNext}>{t.common.next}</button>
            </div>
        </div>
    );
}
