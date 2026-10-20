// Pandemic's texts: the `pandemic` namespace on the platform's i18next instance, registered as
// soon as the game's code loads.
import i18n, { addLocales } from '@platform/ui/i18n';
import en from './locales/en.json';
import fr from './locales/fr.json';
import vi from './locales/vi.json';

export const NS = 'pandemic';
export const locales = { en, vi, fr };

addLocales(NS, locales);

/** For code outside React (toasts, sentences); components use `useTranslation('pandemic')`. */
export const t = i18n.getFixedT(null, NS);
