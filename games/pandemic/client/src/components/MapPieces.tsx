import { CITIES, COLORS, SEATS, type Color, type PandemicView } from '@pandemic/rules';
import type { SeatPresence } from '@platform/ui/game';
import { cityPoint } from '../lib/mapGeometry';
import { seatName } from '../lib/names';
import { Cube } from '../svgs/Cube';
import { PAWN_HEIGHT, PAWN_WIDTH } from '../svgs/Pawn';
import { useLeaving } from '../lib/leaving';
import { MovingPawn } from './MovingPawn';
import { STATION_OUT_MS, StationPiece } from './StationPiece';

/** Cubes go around the city on a circle at least this wide, with this much room for each. */
const ORBIT_MIN = 19;
const CUBE_SLOT = 14;
/** How long a treated cube stays to shrink away. */
const CUBE_OUT_MS = 400;
/** How far apart the pawns of one city stand: they overlap, like a stack of avatars. */
const PAWN_STEP = 6;

/** The cubes of a city, by color, as a flat list (blue first). */
const cubeList = (cubes: Record<Color, number>): Color[] =>
  COLORS.flatMap((color) => Array.from({ length: cubes[color] }, () => color));

/**
 * Everything standing on the map. In each city: the research station in its middle, the pawns of
 * the players there stacked side by side over it (lowest seat on top), and the cubes going around.
 * Cubes and stations pop in when they come and shrink away when they go.
 * Draw it as the map's `children`; it only reads the view.
 */
export function MapPieces({
  view,
  presence,
}: {
  view: PandemicView;
  presence: SeatPresence | null;
}) {
  // Each station and cube is one piece of the page for as long as it exists, so it can play its
  // entrance and, through `useLeaving`, its exit.
  const stations = useLeaving(view.stations, (city) => city, STATION_OUT_MS);
  const cubes = useLeaving(
    CITIES.flatMap(({ id }, cityIndex) => {
      const list = cubeList(view.cubes[id]);
      const seen: Partial<Record<Color, number>> = {};
      return list.map((color, index) => {
        const nth = (seen[color] = (seen[color] ?? 0) + 1);
        return {
          key: `${id}:${color}:${nth}`,
          city: id,
          color,
          index,
          count: list.length,
          seed: cityIndex * 13 + COLORS.indexOf(color) * 3 + nth,
        };
      });
    }),
    (cube) => cube.key,
    CUBE_OUT_MS,
  );
  return (
    <g pointerEvents="none">
      {stations.map(({ item: city, leaving }) => {
        const { x, y } = cityPoint(city);
        return (
          <g key={city} transform={`translate(${x} ${y})`}>
            <StationPiece city={city} leaving={leaving} />
          </g>
        );
      })}
      {cubes.map(({ item: cube, leaving }) => {
        const { x, y } = cityPoint(cube.city);
        return (
          <g key={cube.key} transform={`translate(${x} ${y})`}>
            <Cube
              data-cube={cube.color}
              color={cube.color}
              seed={cube.seed}
              radius={Math.max(ORBIT_MIN, (cube.count * CUBE_SLOT) / (2 * Math.PI))}
              angle={(cube.index / cube.count) * 2 * Math.PI}
              leaving={leaving}
            />
          </g>
        );
      })}
      {/* Always in the same order (seat 4 first), so a pawn is never taken out of the page and put
          back, which would stop its move; the lower seat is on top where pawns share a city. */}
      {[...SEATS].reverse().map((seat) => {
        const city = view.pawns[seat];
        if (!city || !view.seats.includes(seat)) return null;
        const here = SEATS.filter((s) => view.seats.includes(s) && view.pawns[s] === city);
        const { x, y } = cityPoint(city);
        const stackWidth = PAWN_WIDTH + (here.length - 1) * PAWN_STEP;
        return (
          <MovingPawn
            key={seat}
            seat={seat}
            city={city}
            x={x - stackWidth / 2 + here.indexOf(seat) * PAWN_STEP}
            y={y - PAWN_HEIGHT / 2}
            name={seatName(presence, seat)}
          />
        );
      })}
    </g>
  );
}
