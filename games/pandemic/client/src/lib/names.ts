import type { CityId, SeatId } from '@pandemic/rules';
import type { SeatPresence } from '@platform/ui/game';
import { seatInfo } from '@platform/ui/game';

export const cityName = (city: CityId): string =>
  city
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .replace('St ', 'St. ');

export const seatName = (presence: SeatPresence | null, seat: SeatId): string =>
  seatInfo(presence, seat)?.name ?? seat;
