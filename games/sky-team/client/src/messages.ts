import type { EndReason, MoveError, Seat } from '@sky/rules';
import i18n from '@platform/ui/i18n';
import { NS, t } from './i18n';

/** "Pilot" / "Co-pilot" in the current language. */
export const seatName = (seat: Seat): string => t(`seat.${seat}`);

/** The message for a rule's reason (a `MoveError`), or `undefined` if the code is not Sky Team's. */
export function errorText(code: string): string | undefined {
  const key = `errors.${code}`;
  return i18n.exists(key, { ns: NS }) ? t(key as `errors.${MoveError}`) : undefined;
}

/** Why a game was lost, one sentence per reason. */
export const endReasonText = (reason: EndReason): string => t(`endReasons.${reason}`);
