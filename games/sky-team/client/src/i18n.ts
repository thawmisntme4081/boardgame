// Sky Team's texts: the `sky-team` namespace on the platform's i18next instance, registered
// as soon as the game's code loads.
import i18n, { addLocales, currentLanguage, formatNumber } from '@platform/ui/i18n';
import en from './locales/en.json';
import fr from './locales/fr.json';
import vi from './locales/vi.json';

export const NS = 'sky-team';
export const locales = { en, vi, fr };

addLocales(NS, locales);

/** For code outside React (toasts, sentences); components use `useTranslation('sky-team')`. */
export const t = i18n.getFixedT(null, NS);

export { currentLanguage, formatNumber };
