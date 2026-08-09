import { useState } from 'react';
import { useTranslation } from '../i18n';
import Modal from './Modal';

export default function JoinDialog({ onJoin, onClose }) {
    const { t } = useTranslation();
    const l = t.landing;
    const [code, setCode] = useState('');
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    const submit = async event => {
        event.preventDefault();
        const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (clean.length < 4) return;

        setBusy(true);
        setError(null);
        const message = await onJoin(clean);
        setBusy(false);
        if (message) setError(message);
    };

    return (
        <Modal title={l.joinTitle} onClose={onClose}>
            <p className="modal-intro">{l.joinSubtitle}</p>

            <form onSubmit={submit}>
                <input
                    className="code-input"
                    value={code}
                    onChange={event => setCode(event.target.value.toUpperCase())}
                    placeholder={l.joinPlaceholder}
                    maxLength={8}
                    autoFocus
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    inputMode="text"
                />

                {error && <div className="error-banner">{error}</div>}

                <div className="modal-actions">
                    <button
                        type="submit"
                        className="btn btn-primary btn-block"
                        disabled={busy || code.trim().length < 4}
                    >
                        {l.joinButton}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
