import i18n from '@platform/ui/i18n';
import { NS, t } from './i18n';

/** The message for a rule's reason, or `undefined` if the code is not Pandemic's. */
export function errorText(code: string): string | undefined {
  const key = `errors.${code}`;
  return i18n.exists(key, { ns: NS }) ? t(key as 'errors.game-over') : undefined;
}
