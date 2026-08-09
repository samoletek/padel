import { useState } from 'react';
import { useTranslation } from '../i18n';
import Modal from './Modal';
import QrCode from './QrCode';

export default function ShareDialog({ code, url, onClose }) {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(url);
        } catch {
            const field = document.createElement('input');
            field.value = url;
            document.body.appendChild(field);
            field.select();
            document.execCommand('copy');
            field.remove();
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const share = async () => {
        if (!navigator.share) return copy();
        try {
            await navigator.share({ title: 'Padel Mix', text: `Room ${code}`, url });
        } catch { /* user dismissed the sheet */ }
        return undefined;
    };

    return (
        <Modal title={t.room.shareTitle} kicker={t.room.codeLabel} onClose={onClose}>
            <p className="modal-intro">{t.room.shareSubtitle}</p>

            <div className="share-body">
                <QrCode value={url} size={190} />
                <div className="share-code">{code}</div>
                <div className="share-url">{url}</div>
            </div>

            <div className="modal-actions">
                <button className="btn btn-secondary" onClick={copy}>
                    {copied ? t.common.copied : t.common.copy}
                </button>
                {typeof navigator !== 'undefined' && navigator.share && (
                    <button className="btn btn-primary" onClick={share}>
                        {t.room.shareButton}
                    </button>
                )}
            </div>
        </Modal>
    );
}
