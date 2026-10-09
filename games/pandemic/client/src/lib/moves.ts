import {
  canActInView,
  type Action,
  type CityId,
  type PandemicView,
  type SeatId,
} from '@pandemic/rules';

/** The four ways to move, tried in this order for the popover. */
export const MOVE_TYPES = ['drive', 'direct', 'charter', 'shuttle'] as const;
export type MoveType = (typeof MOVE_TYPES)[number];

/** The moving actions legal for `seat` to reach `city` right now, in `MOVE_TYPES` order. */
export function movesTo(view: PandemicView, seat: SeatId, city: CityId): Action[] {
  return MOVE_TYPES.map((type) => ({ type, to: city }) as Action).filter((action) =>
    canActInView(view, seat, action),
  );
}

/** Every city `seat` could move to right now, by any of the four ways. */
export function reachableCities(
  view: PandemicView,
  seat: SeatId,
  cities: readonly { id: CityId }[],
): Set<CityId> {
  const set = new Set<CityId>();
  for (const { id } of cities) if (movesTo(view, seat, id).length > 0) set.add(id);
  return set;
}
