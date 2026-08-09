import { useTranslation } from '../i18n';

export default function LandingStep({ onNext, onJoin }) {
    const { t } = useTranslation();
    const l = t.landing;

    return (
        <div className="landing step-enter">
            <div className="landing-badge">{l.badge}</div>

            <h1>
                {l.title1}
                <br />
                {l.title2} <span>{l.titleHighlight}</span>
            </h1>

            <p className="landing-subtitle">{l.subtitle}</p>

            <div className="features">
                {l.features.map(feature => (
                    <div className="feature-card" key={feature.title}>
                        <div className="feature-icon">{feature.icon}</div>
                        <div className="feature-title">{feature.title}</div>
                        <div className="feature-desc">{feature.desc}</div>
                    </div>
                ))}
            </div>

            <div className="tilt-note">{l.note}</div>

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
