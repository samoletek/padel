import { useEffect, useState } from 'react';
import { useTranslation } from '../i18n';

export default function Modal({ title, kicker, onClose, children, footer, wide }) {
    const { t } = useTranslation();
    const [isClosing, setIsClosing] = useState(false);

    const close = () => {
        setIsClosing(true);
        setTimeout(onClose, 200);
    };

    useEffect(() => {
        const onKeyDown = event => {
            if (event.key === 'Escape') close();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className={`modal-backdrop ${isClosing ? 'closing' : ''}`} onMouseDown={close}>
            <div
                className={`modal ${wide ? 'modal-wide' : ''}`}
                role="dialog"
                aria-modal="true"
                onMouseDown={event => event.stopPropagation()}
            >
                <div className="modal-header">
                    <div>
                        {kicker && <div className="modal-kicker">{kicker}</div>}
                        <h2>{title}</h2>
                    </div>
                    <button
                        type="button"
                        className="modal-close"
                        onClick={close}
                        aria-label={t.common.close}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            width="14"
                            height="14"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ display: 'block' }}
                        >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div className="modal-body">{children}</div>

                {footer && <div className="modal-footer">{footer}</div>}
            </div>
        </div>
    );
}
