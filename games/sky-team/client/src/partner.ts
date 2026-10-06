import { otherSeat, type PlayerView, type Presence } from '@sky/rules';
import { seatName } from './messages';

/** Your partner: their seat, their presence (if they are in the room), and what to call them. */
export function partnerOf(view: PlayerView, presence: Presence | null) {
  const seat = otherSeat(view.seat);
  const info = presence?.[seat];
  return { seat, info, name: info?.name ?? seatName(seat) };
}
