import { pawnOwner, type CityId, type PawnId, type SeatId } from '@pandemic/rules';
import type { SeatPresence } from '@platform/ui/game';
import { seatInfo } from '@platform/ui/game';
import { t } from '../i18n';

export const cityName = (city: CityId): string =>
  city
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .replace('St ', 'St. ');

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
