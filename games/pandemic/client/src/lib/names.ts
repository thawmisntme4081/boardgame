import type { CityId, SeatId } from '@pandemic/rules';
import type { SeatPresence } from '@platform/ui/game';
import { seatInfo } from '@platform/ui/game';

/** A city's name from its id ("new-york" is "New York"); translated names come later. */
export const cityName = (city: CityId): string =>
  city
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .replace('St ', 'St. ');

/** A seat's player name from presence; the seat id until the player is known. */
export const seatName = (presence: SeatPresence | null, seat: SeatId): string =>
  seatInfo(presence, seat)?.name ?? seat;
