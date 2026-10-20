import {
  CITIES,
  MAX_STATIONS,
  canActInView,
  type CityId,
  type EventId,
  type PandemicView,
  type PawnId,
  type SeatId,
} from '@pandemic/rules';

/**
 * An event card being played that still needs choices: Airlift's pawn then city, Government
 * Grant's city (then the station to move once all 6 are built), Resilient Population's card.
 * Forecast and One Quiet Night need none and are sent at once.
 */
export type EventPlan =
  | { event: 'airlift'; owner: SeatId; pawn: PawnId | null }
  | { event: 'government-grant'; owner: SeatId; city: CityId | null }
  | { event: 'resilient-population'; owner: SeatId };

/** The `owner` part of a `play-event` move: only when the card is another player's. */
export const ownerPart = (you: SeatId, owner: SeatId): { owner?: SeatId } =>
  owner === you ? {} : { owner };

/** The cities the map offers for the plan (tap one to choose it), or `null` when it is not a map choice. */
export function eventTargets(
  view: PandemicView,
  seat: SeatId,
  plan: EventPlan | null,
): Set<CityId> | null {
  if (plan?.event === 'airlift' && plan.pawn !== null) {
    const { pawn } = plan;
    return new Set(
      CITIES.filter(({ id }) =>
        canActInView(view, seat, {
          type: 'play-event',
          event: 'airlift',
          ...ownerPart(seat, plan.owner),
          pawn,
          to: id,
        }),
      ).map(({ id }) => id),
    );
  }
  if (plan?.event === 'government-grant' && plan.city === null) {
    return new Set(CITIES.filter(({ id }) => !view.stations.includes(id)).map(({ id }) => id));
  }
  return null;
}

/** All 6 stations are built: a Government Grant must take one away. */
export const grantMovesStation = (view: PandemicView): boolean =>
  view.stations.length >= MAX_STATIONS;

/** The event cards others played in the move that led from `before` to `view` (none on a new turn). */
export function newEventsOf(view: PandemicView, before: PandemicView | null) {
  if (!before || before.log.current.seat !== view.log.current.seat) return [];
  const known = before.log.current.entries.filter((entry) => entry.type === 'event').length;
  return view.log.current.entries.filter((entry) => entry.type === 'event').slice(known);
}

export type { EventId };

/** `list` with the item at `from` moved to position `to` (Forecast's new order). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (from < 0 || from >= next.length || to < 0 || to >= next.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}
