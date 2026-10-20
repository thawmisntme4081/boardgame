import { pawnOwner, type CityId, type PawnId, type SeatId } from '@pandemic/rules';
import type { SeatPresence } from '@platform/ui/game';
import { seatInfo } from '@platform/ui/game';
import { t } from '../i18n';

/** A city's short name in the current language (`cities.<id>`). */
export const cityName = (city: CityId): string => t(`cities.${city}`);

/** A long name on two lines, split at the space or hyphen nearest its middle. */
export function labelLines(name: string): string[] {
  if (name.length <= 12) return [name];
  const middle = name.length / 2;
  let best = -1;
  for (let i = 0; i < name.length; i++) {
    if (
      (name[i] === ' ' || name[i] === '-') &&
      (best < 0 || Math.abs(i - middle) < Math.abs(best - middle))
    )
      best = i;
  }
  if (best < 0) return [name];
  return [name.slice(0, best + (name[best] === '-' ? 1 : 0)), name.slice(best + 1)];
}

export const seatName = (presence: SeatPresence | null, seat: SeatId): string =>
  seatInfo(presence, seat)?.name ?? seat;

/** Is this pawn one of a Teacher's students (not the seat's own)? */
export const isStudent = (pawn: PawnId): boolean => pawn !== pawnOwner(pawn);

/** A pawn's name: its owner's, or "<owner>'s student" for a Teacher's student. */
export const pawnName = (presence: SeatPresence | null, pawn: PawnId): string => {
  const name = seatName(presence, pawnOwner(pawn));
  return isStudent(pawn) ? t('pawns.studentOf', { name }) : name;
};

/** One of your own pawns, when you have several (a Teacher): "Teacher pawn", "Student 1". */
export const ownPawnLabel = (pawn: PawnId): string =>
  isStudent(pawn) ? t('pawns.student', { number: pawn.slice(-1) }) : t('pawns.teacher');
