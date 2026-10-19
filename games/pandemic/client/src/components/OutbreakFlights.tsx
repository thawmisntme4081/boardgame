import { cityOf, type CityId, type Color, type PandemicView } from '@pandemic/rules';
import { useLayoutEffect, useRef, useState } from 'react';
import { cityPoint } from '../lib/mapGeometry';
import { CubeIcon } from '../svgs/CubeIcon';

/** One cube leaving the city that broke out for a neighbor that got it. */
export interface OutbreakFlight {
  id: number;
  from: CityId;
  to: CityId;
  color: Color;
  /** Ms before it leaves: chain reactions go off one after the other. */
  delay: number;
}

const FLIGHT_MS = 650;
const STEP_MS = 450;
const SIZE = 18;

/**
 * The cubes an outbreak scattered, found by comparing a view with the one before it: for each
 * outbreak the infection log says, the neighbors whose cubes of that color went up. Returns the
 * flights to play for the view that just arrived, and removes them once played. Nothing plays
 * for the first view seen.
 */
function useOutbreakFlights(view: PandemicView): {
  flights: OutbreakFlight[];
  done: (id: number) => void;
} {
  const entries = view.log.current.entries;
  const [seen, setSeen] = useState({
    seat: view.log.current.seat,
    count: entries.length,
    cubes: view.cubes,
  });
  const [flights, setFlights] = useState<OutbreakFlight[]>([]);
  if (seen.cubes !== view.cubes) {
    setSeen({ seat: view.log.current.seat, count: entries.length, cubes: view.cubes });
    // The turn we were watching: still the current one, or just ended (now the previous one,
    // which is where the turn's last infection lands).
    const { current, previous } = view.log;
    const watched =
      current.seat === seen.seat ? current : previous?.seat === seen.seat ? previous : null;
    const fresh: OutbreakFlight[] = [];
    for (const entry of watched?.entries.slice(seen.count) ?? []) {
      // An infection, or cubes a pawn took along, that broke out.
      if (entry.type !== 'infect' && entry.type !== 'carried') continue;
      if (entry.outbreaks.length === 0) continue;
      entry.outbreaks.forEach((from, step) => {
        for (const to of cityOf(from).links) {
          if (view.cubes[to][entry.color] <= seen.cubes[to][entry.color]) continue;
          fresh.push({
            id: (flights.at(-1)?.id ?? 0) + fresh.length + 1,
            from,
            to,
            color: entry.color,
            delay: step * STEP_MS,
          });
        }
      });
    }
    if (fresh.length > 0) setFlights((list) => [...list, ...fresh]);
  }
  return { flights, done: (id) => setFlights((list) => list.filter((f) => f.id !== id)) };
}

const at = (x: number, y: number, scale = 1) => `translate(${x}px, ${y}px) scale(${scale})`;

function Flight({ flight, onDone }: { flight: OutbreakFlight; onDone: () => void }) {
  const group = useRef<SVGGElement>(null);
  const ring = useRef<SVGCircleElement>(null);
  const from = cityPoint(flight.from);
  const to = cityPoint(flight.to);
  useLayoutEffect(() => {
    const options = { duration: FLIGHT_MS, delay: flight.delay, fill: 'both' } as const;
    // The shockwave at the city that broke out.
    ring.current?.animate(
      [
        { transform: 'scale(0.4)', opacity: 0.9 },
        { transform: 'scale(2.6)', opacity: 0 },
      ],
      { ...options, easing: 'ease-out' },
    );
    // The cube leaves it for the neighbor, in a small arc.
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - 18 };
    group.current?.animate(
      [
        { transform: at(from.x - SIZE / 2, from.y - SIZE / 2, 0.5), opacity: 0 },
        { transform: at(from.x - SIZE / 2, from.y - SIZE / 2, 1), opacity: 1, offset: 0.15 },
        { transform: at(mid.x - SIZE / 2, mid.y - SIZE / 2, 1.2), opacity: 1, offset: 0.55 },
        { transform: at(to.x - SIZE / 2, to.y - SIZE / 2, 0.8), opacity: 1, offset: 0.95 },
        { transform: at(to.x - SIZE / 2, to.y - SIZE / 2, 0.8), opacity: 0 },
      ],
      { ...options, easing: 'ease-in-out' },
    );
    const timer = setTimeout(onDone, FLIGHT_MS + flight.delay + 100);
    return () => clearTimeout(timer);
    // Once: a flight is fixed when it starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <g pointerEvents="none" aria-hidden="true" data-outbreak-flight={`${flight.from}>${flight.to}`}>
      <g transform={`translate(${from.x} ${from.y})`}>
        <circle
          ref={ring}
          r={16}
          fill="none"
          stroke="oklch(0.65 0.24 25)"
          strokeWidth={4}
          style={{ transformBox: 'fill-box', transformOrigin: 'center', opacity: 0 }}
        />
      </g>
      <g ref={group} style={{ transform: at(from.x - SIZE / 2, from.y - SIZE / 2), opacity: 0 }}>
        <CubeIcon color={flight.color} width={SIZE} height={(SIZE * 22) / 20} />
      </g>
    </g>
  );
}

/** The outbreak flights being played. Draw it as a child of the map's <svg>, above the pieces. */
export function OutbreakFlights({ view }: { view: PandemicView }) {
  const { flights, done } = useOutbreakFlights(view);
  return (
    <g pointerEvents="none">
      {flights.map((flight) => (
        <Flight key={flight.id} flight={flight} onDone={() => done(flight.id)} />
      ))}
    </g>
  );
}
