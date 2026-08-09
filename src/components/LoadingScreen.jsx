import { useTranslation } from '../i18n';

export default function LoadingScreen({ label }) {
    const { t } = useTranslation();

    return (
        <div className="loading-screen step-enter">
            <div className="loading-spinner" />
            <h2>{label || t.courts.creating}</h2>
        </div>
    );
}
