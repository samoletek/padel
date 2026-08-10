import { useTranslation } from '../i18n';

export default function LandingStep({ onNext, onJoin }) {
    const { t } = useTranslation();
    const l = t.landing;

    return (
        <div className="landing step-enter">
            <div className="landing-badge">{l.badge}</div>

            <h1>
                {l.title} <span>{l.titleHighlight}</span>
            </h1>

            <ol className="how-steps">
                {l.steps.map((step, index) => (
                    <li className="how-step" key={step.title}>
                        <span className="how-step-num">{String(index + 1).padStart(2, '0')}</span>
                        <span className="how-step-text">
                            <strong>{step.title}</strong>
                            <span>{step.desc}</span>
                        </span>
                    </li>
                ))}
            </ol>

            <div className="landing-actions">
                <button className="btn btn-primary btn-large" onClick={onNext}>
                    {l.cta}
                </button>
                <button className="btn btn-secondary btn-large" onClick={onJoin}>
                    {l.joinCta}
                </button>
            </div>
        </div>
    );
}
