import type { CityId } from '@pandemic/rules';
import { useEffect, useState } from 'react';

export interface InfectionDraw {
  key: string;
  city: CityId;
}

/**
 * The infection discard pile as it is shown on the map, and the cards flying from the deck to it
 * right now: when a card is drawn (the pile grows), the pile keeps showing its old top card for
 * `ms` while a flight plays, then shows the new one; several draws in a row queue one flight
 * each. Nothing flies on the first render (the page just opened or reconnected): the pile shows
 * the real pile at once.
 */
export function useInfectionPile(
  discard: readonly CityId[],
  ms: number,
): { shown: readonly CityId[]; flights: InfectionDraw[] } {
  // `seen` is the discard we last reacted to (so a change is noticed only once); `shown` is what
  // the pile displays, which a flight holds back until it lands.
  const [seen, setSeen] = useState(discard);
  const [shown, setShown] = useState(discard);
  const [flights, setFlights] = useState<InfectionDraw[]>([]);

  if (seen !== discard) {
    const grew = discard.length > seen.length;
    const top = discard[discard.length - 1];
    setSeen(discard);
    if (grew && top) {
      setFlights((all) => [...all, { key: `${discard.length}-${top}-${all.length}`, city: top }]);
    } else {
      setShown(discard);
    }
  }

  useEffect(() => {
    if (flights.length === 0) return;
    const timer = setTimeout(() => {
      setFlights((all) => all.slice(1));
      setShown(discard);
    }, ms);
    return () => clearTimeout(timer);
  }, [flights, discard, ms]);

  return { shown, flights };
}
