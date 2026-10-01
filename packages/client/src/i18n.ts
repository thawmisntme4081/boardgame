// Translations. English is the default; a player's choice is kept on their device. The
// server and rules only send codes (errors, end reasons, ids): all text lives here.
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import vi from './locales/vi.json';

export const LANGUAGES = { en: 'English', vi: 'Tiếng Việt' } as const;
export type Language = keyof typeof LANGUAGES;

const STORAGE_KEY = 'sky-team-language';

function savedLanguage(): Language {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'vi' ? 'vi' : 'en';
  } catch {
    return 'en';
  }
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, vi: { translation: vi } },
  lng: savedLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React escapes already
  initAsync: false,
});

document.documentElement.lang = i18n.language;

/** Switches language everywhere at once, and remembers it on this device. */
export function setLanguage(language: Language): void {
  void i18n.changeLanguage(language);
  document.documentElement.lang = language;
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Private mode: the choice lasts for this page only.
  }
}

export const currentLanguage = (): Language => (i18n.language === 'vi' ? 'vi' : 'en');

/** For code outside React (toasts, messages); components use `useTranslation()`. */
export const t = i18n.t.bind(i18n);

/** Numbers in the current language, e.g. "6,000" in English, "6.000" in Vietnamese. */
export const formatNumber = (n: number): string => new Intl.NumberFormat(i18n.language).format(n);

export default i18n;
