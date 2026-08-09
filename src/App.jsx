import { useCallback, useEffect, useState } from 'react';
import { useTranslation, AVAILABLE_LANGUAGES } from './i18n';
import {
    createRoom as buildRoomLocally,
    defaultRoundsFor,
    maxCourtsFor,
} from '../shared/engine.js';
import { createRoom as createRoomOnServer, fetchRoom } from './lib/api';
import { loadLocalRoom, saveLocalRoom, clearLocalRoom, saveLastNames } from './lib/storage';
import useRoom from './lib/useRoom';
import LandingStep from './components/LandingStep';
import FormatStep from './components/FormatStep';
import PlayersStep from './components/PlayersStep';
import NamesStep from './components/NamesStep';
import CourtsStep from './components/CourtsStep';
import LoadingScreen from './components/LoadingScreen';
import JoinDialog from './components/JoinDialog';
import RoomView from './components/RoomView';
import Modal from './components/Modal';

const SETUP_STEPS = ['landing', 'format', 'players', 'names', 'courts'];
const LOCAL_CODE = 'LOCAL';

const defaultCourtNames = count => Array.from({ length: count }, (_, i) => `Court ${i + 1}`);

function readHashCode() {
    const match = window.location.hash.match(/^#\/r\/([A-Za-z0-9]{1,8})$/);
    return match ? match[1].toUpperCase() : null;
}

export default function App() {
    const { t } = useTranslation();

    const [step, setStep] = useState('booting');
    const [format, setFormat] = useState('americano');
    const [playerCount, setPlayerCount] = useState(8);
    const [names, setNames] = useState(() => Array.from({ length: 8 }, () => ''));
    const [courtCount, setCourtCount] = useState(2);
    const [courtNames, setCourtNames] = useState(() => defaultCourtNames(2));
    const [rounds, setRounds] = useState(() => defaultRoundsFor(8));
    const [pointsPerMatch, setPointsPerMatch] = useState(24);

    const [activeRoom, setActiveRoom] = useState(null);
    const [isLocalRoom, setIsLocalRoom] = useState(false);
    const [setupError, setSetupError] = useState(null);
    const [syncOffline, setSyncOffline] = useState(false);
    const [showJoin, setShowJoin] = useState(false);
    const [showHowItWorks, setShowHowItWorks] = useState(false);

    const enterRoom = useCallback((room, { local = false } = {}) => {
        setActiveRoom(room);
        setIsLocalRoom(local);
        setStep('room');
        window.location.hash = local ? '#/local' : `#/r/${room.code}`;
    }, []);

    // Restore whatever the URL points at: a shared room, or a device-only session.
    useEffect(() => {
        let cancelled = false;

        const boot = async () => {
            const code = readHashCode();

            if (code) {
                try {
                    const result = await fetchRoom(code);
                    if (cancelled) return;
                    if (result.room) {
                        enterRoom(result.room);
                        return;
                    }
                } catch { /* fall through to the landing page */ }
            }

            if (window.location.hash === '#/local') {
                const saved = loadLocalRoom();
                if (saved && !cancelled) {
                    enterRoom(saved, { local: true });
                    return;
                }
            }

            if (!cancelled) setStep('landing');
        };

        boot();
        return () => { cancelled = true; };
    }, [enterRoom]);

    const applyPlayerCount = count => {
        setPlayerCount(count);
        setNames(current => Array.from({ length: count }, (_, i) => current[i] ?? ''));
        const maxCourts = maxCourtsFor(count);
        const nextCourts = Math.min(courtCount, maxCourts);
        setCourtCount(nextCourts);
        setCourtNames(current =>
            Array.from({ length: nextCourts }, (_, i) => current[i] ?? `Court ${i + 1}`),
        );
        setRounds(defaultRoundsFor(count));
    };

    const applyCourtCount = count => {
        setCourtCount(count);
        setCourtNames(current =>
            Array.from({ length: count }, (_, i) => current[i] ?? `Court ${i + 1}`),
        );
    };

    const handleCreate = async () => {
        const payload = {
            format,
            playerNames: names.map(name => name.trim()),
            courtNames: Array.from(
                { length: courtCount },
                (_, i) => (courtNames[i] || '').trim() || `Court ${i + 1}`,
            ),
            rounds,
            pointsPerMatch,
        };

        setSetupError(null);
        setStep('creating');
        saveLastNames(payload.playerNames);

        try {
            const room = await createRoomOnServer(payload);
            enterRoom(room);
        } catch (err) {
            if (err.code === 'sync_unavailable' || err.status === 503 || !err.status) {
                // No shared backend available — keep the session usable on this phone.
                const room = buildRoomLocally({ ...payload, code: LOCAL_CODE });
                saveLocalRoom(room);
                setSyncOffline(true);
                enterRoom(room, { local: true });
                return;
            }
            setSetupError(err.message);
            setStep('courts');
        }
    };

    const handleJoin = async code => {
        try {
            const result = await fetchRoom(code);
            if (!result.room) return t.landing.joinNotFound;
            setShowJoin(false);
            enterRoom(result.room);
            return null;
        } catch (err) {
            if (err.code === 'not_found') return t.landing.joinNotFound;
            return err.message;
        }
    };

    const handleLeave = () => {
        if (!window.confirm(t.room.leaveConfirm)) return;
        if (isLocalRoom) clearLocalRoom();
        setActiveRoom(null);
        setIsLocalRoom(false);
        window.location.hash = '';
        setStep('landing');
    };

    const stepIndex = SETUP_STEPS.indexOf(step);

    return (
        <div className="app">
            <LanguageToggle />

            <div className={`app-content ${step === 'room' ? 'app-content-room' : ''}`}>
                {stepIndex > 0 && (
                    <StepIndicator total={SETUP_STEPS.length - 1} current={stepIndex - 1} />
                )}

                {step === 'booting' && <LoadingScreen label={t.room.syncing} />}

                {step === 'landing' && (
                    <LandingStep
                        onNext={() => setStep('format')}
                        onJoin={() => setShowJoin(true)}
                    />
                )}

                {step === 'format' && (
                    <FormatStep
                        value={format}
                        onChange={setFormat}
                        onNext={() => setStep('players')}
                        onBack={() => setStep('landing')}
                    />
                )}

                {step === 'players' && (
                    <PlayersStep
                        value={playerCount}
                        onChange={applyPlayerCount}
                        onNext={() => setStep('names')}
                        onBack={() => setStep('format')}
                    />
                )}

                {step === 'names' && (
                    <NamesStep
                        names={names}
                        onChange={setNames}
                        onNext={() => setStep('courts')}
                        onBack={() => setStep('players')}
                    />
                )}

                {step === 'courts' && (
                    <CourtsStep
                        playerCount={playerCount}
                        courtCount={courtCount}
                        courtNames={courtNames}
                        rounds={rounds}
                        pointsPerMatch={pointsPerMatch}
                        onCourtCountChange={applyCourtCount}
                        onCourtNamesChange={setCourtNames}
                        onRoundsChange={setRounds}
                        onPointsChange={setPointsPerMatch}
                        onCreate={handleCreate}
                        onBack={() => setStep('names')}
                        offline={syncOffline}
                        error={setupError}
                    />
                )}

                {step === 'creating' && <LoadingScreen />}

                {step === 'room' && activeRoom && (
                    <RoomSession
                        initialRoom={activeRoom}
                        local={isLocalRoom}
                        onLeave={handleLeave}
                    />
                )}
            </div>

            {step !== 'room' && <Footer onHowItWorks={() => setShowHowItWorks(true)} />}

            {showJoin && <JoinDialog onJoin={handleJoin} onClose={() => setShowJoin(false)} />}
            {showHowItWorks && <HowItWorksModal onClose={() => setShowHowItWorks(false)} />}
        </div>
    );
}

function RoomSession({ initialRoom, local, onLeave }) {
    const { room, connection, act, actionError, dismissError } = useRoom(initialRoom, { local });
    if (!room) return <LoadingScreen />;

    return (
        <RoomView
            room={room}
            connection={local ? 'local' : connection}
            act={act}
            actionError={actionError}
            dismissError={dismissError}
            onLeave={onLeave}
        />
    );
}

function LanguageToggle() {
    const { lang, setLang } = useTranslation();

    return (
        <div className="lang-toggle">
            {AVAILABLE_LANGUAGES.map(({ code, label }) => (
                <button
                    key={code}
                    className={`lang-btn ${lang === code ? 'active' : ''}`}
                    onClick={() => setLang(code)}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}

function StepIndicator({ total, current }) {
    return (
        <div className="step-indicator">
            {Array.from({ length: total }, (_, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                        className={`step-dot ${index === current ? 'active' : index < current ? 'completed' : ''}`}
                    />
                    {index < total - 1 && (
                        <div className={`step-line ${index < current ? 'completed' : ''}`} />
                    )}
                </div>
            ))}
        </div>
    );
}

function Footer({ onHowItWorks }) {
    const { t } = useTranslation();

    return (
        <footer className="app-footer">
            <button type="button" className="how-it-works-button" onClick={onHowItWorks}>
                {t.howItWorks.button}
            </button>
        </footer>
    );
}

function HowItWorksModal({ onClose }) {
    const { t } = useTranslation();
    const content = t.howItWorks;

    return (
        <Modal title={content.title} kicker={content.kicker} onClose={onClose} wide>
            <p className="modal-intro">{content.intro}</p>

            <div className="how-it-works-sections">
                {content.sections.map(section => (
                    <section key={section.title} className="how-it-works-section">
                        <h3>{section.title}</h3>
                        <p>{section.description}</p>
                        <div className="how-it-works-effect">
                            <strong>{content.effectLabel}</strong>
                            <span>{section.effect}</span>
                        </div>
                    </section>
                ))}
            </div>

            {content.note && <div className="modal-note">{content.note}</div>}
        </Modal>
    );
}
