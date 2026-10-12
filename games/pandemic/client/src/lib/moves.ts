import {
  canActInView,
  type CityId,
  type PandemicMove,
  type PandemicView,
  type SeatId,
} from '@pandemic/rules';

/** The ways to move a pawn, tried in this order for the popover (`join` needs a role). */
export const MOVE_TYPES = ['drive', 'direct', 'charter', 'shuttle', 'join'] as const;
export type MoveType = (typeof MOVE_TYPES)[number] | 'ops-flight';

/**
 * The legal moves for `seat` to bring `pawn` (their own by default, another's with a role that
 * moves pawns) to `city`, in `MOVE_TYPES` order, then a role's own flights (one per card).
 */
export function movesTo(
  view: PandemicView,
  seat: SeatId,
  city: CityId,
  pawn: SeatId = seat,
): PandemicMove[] {
  const other = pawn === seat ? {} : { pawn };
  const moves: PandemicMove[] = MOVE_TYPES.map((type) => ({ type, to: city, ...other }));
  if (pawn === seat) {
    for (const card of view.hands[seat] ?? []) {
      if (card.kind === 'city') moves.push({ type: 'ops-flight', to: city, card: card.city });
    }
  }
  return moves.filter((move) => canActInView(view, seat, move));
}

/** Every city `seat` could bring `pawn` to right now, by any of the ways. */
export function reachableCities(
  view: PandemicView,
  seat: SeatId,
  cities: readonly { id: CityId }[],
  pawn: SeatId = seat,
): Set<CityId> {
  const set = new Set<CityId>();
  for (const { id } of cities) if (movesTo(view, seat, id, pawn).length > 0) set.add(id);
  return set;
}
