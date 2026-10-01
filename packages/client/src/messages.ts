import type { EndReason, ErrorCode, MoveError, Seat } from '@sky/shared';
import i18n, { t } from '@/i18n';

/** "Pilot" / "Co-pilot" in the current language. */
export const seatName = (seat: Seat): string => t(`seat.${seat}`);

/** The message for a room error or rule reason; unknown codes get a generic message. */
export function errorText(code: string): string {
  const key = `errors.${code}`;
  return i18n.exists(key) ? t(key as `errors.${ErrorCode | MoveError}`) : t('errors.unknown');
}

/** Why a game was lost, one sentence per reason. */
export const endReasonText = (reason: EndReason): string => t(`endReasons.${reason}`);
