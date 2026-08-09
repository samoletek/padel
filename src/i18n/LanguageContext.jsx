import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import en from './en';
import ru from './ru';

const LANGUAGES = { en, ru };
const DEFAULT_LANG = 'en';
const STORAGE_KEY = 'padel-lang';

function getSavedLanguage() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && LANGUAGES[saved]) return saved;
        const browser = (navigator.language || '').slice(0, 2).toLowerCase();
        return LANGUAGES[browser] ? browser : DEFAULT_LANG;
    } catch {
        return DEFAULT_LANG;
    }
}

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
    const [lang, setLangState] = useState(getSavedLanguage);

    const setLang = useCallback((code) => {
        if (LANGUAGES[code]) {
            setLangState(code);
            try { localStorage.setItem(STORAGE_KEY, code); } catch { }
        }
    }, []);

    const t = useMemo(() => LANGUAGES[lang], [lang]);
    const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useTranslation() {
    const ctx = useContext(LanguageContext);
    if (!ctx) throw new Error('useTranslation must be inside LanguageProvider');
    return ctx;
}

export const AVAILABLE_LANGUAGES = [
    { code: 'en', label: 'EN' },
    { code: 'ru', label: 'RU' },
];
