// Pandemic's texts: the `pandemic` namespace on the platform's i18next instance, registered as
// soon as the game's code loads. Only English for now (Vietnamese and French come in the
// translations phase); the other languages fall back to it.
import i18n, { addLocales } from '@platform/ui/i18n';
import en from './locales/en.json';

export const NS = 'pandemic';
export const locales = { en, vi: en, fr: en };

addLocales(NS, locales);

/** For code outside React (toasts, sentences); components use `useTranslation('pandemic')`. */
export const t = i18n.getFixedT(null, NS);
