// Translations for the platform and every game: one i18next instance, one namespace each
// (`platform` for the shell, the game's id for its own texts). English is the default; a
// player's choice is kept on their device. The server and rules only send codes.
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import fr from './locales/fr.json';
import vi from './locales/vi.json';

export const LANGUAGES = { en: 'English', vi: 'Tiếng Việt', fr: 'Français' } as const;
export type Language = keyof typeof LANGUAGES;

/** One namespace's texts in every language (the same keys in each). */
export type Locales = Record<Language, Record<string, unknown>>;

const STORAGE_KEY = 'sky-team-language';

const isLanguage = (code: string | null): code is Language => !!code && code in LANGUAGES;

function savedLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return isLanguage(saved) ? saved : 'en';
  } catch {
    return 'en';
  }
}

void i18n.use(initReactI18next).init({
  // The shell's own texts; each game adds its namespace when its module loads.
  resources: { en: { platform: en }, vi: { platform: vi }, fr: { platform: fr } },
  lng: savedLanguage(),
  fallbackLng: 'en',
  defaultNS: 'platform',
  ns: ['platform'],
  interpolation: { escapeValue: false }, // React escapes already
  initAsync: false,
});

if (typeof document !== 'undefined') document.documentElement.lang = i18n.language;

/** Adds a namespace's texts (the shell's at start, a game's when its module loads). */
export function addLocales(namespace: string, locales: Locales): void {
  for (const language of Object.keys(locales) as Language[]) {
    i18n.addResourceBundle(language, namespace, locales[language], true, true);
  }
}

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

export const currentLanguage = (): Language => (isLanguage(i18n.language) ? i18n.language : 'en');

/** Numbers in the current language, e.g. "6,000" in English, "6.000" in Vietnamese. */
export const formatNumber = (n: number): string => new Intl.NumberFormat(i18n.language).format(n);

export default i18n;
