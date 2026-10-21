import {
  COLORS,
  CITIES,
  PACIFIC_LINKS,
  type CityId,
  type Color,
  type CureState,
} from '@pandemic/rules';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BoardFurniture } from './BoardFurniture';
import { CURE_SLOTS, MAP_HEIGHT, MAP_WIDTH, cityPoint } from '../lib/mapGeometry';
import { WORLD_LAND } from '../lib/worldLand';
import { cityName, labelLines } from '../lib/names';
import { CURE_MARKER_INSET, CURE_MARKER_WIDTH, CureMarker } from '../svgs/CureMarker';

export interface WorldMapProps {
  onSelect?: (city: CityId) => void;
  /** Tapping the sea, a continent or any spot that is not a city. */
  onBackgroundClick?: () => void;
  selected?: CityId | null;
  /** A city to point out (the pointer is on its card in a hand). */
  highlight?: CityId | null;
  reachable?: ReadonlySet<CityId>;
  /** A vial in the disease slot once cured (gold outline when eradicated). */
  cures?: Record<Color, CureState>;
  /** Drawn in a band below the map (your hand). */
  hand?: ReactNode;
  /** Height of that band in map units. */
  handHeight?: number;
  children?: ReactNode;
}

const OCEAN = 'oklch(0.3 0.06 245)';
const LAND = 'oklch(0.5 0.07 150)';
const COAST = 'oklch(0.68 0.07 150)';
const LINK = 'oklch(0.95 0 0 / 0.7)';

/** Every white line of the board once (the Pacific ones are drawn apart, cut at the map's edges). */
const LINKS: readonly (readonly [CityId, CityId])[] = CITIES.flatMap(({ id, links }) =>
  links
    .filter((other) => id < other)
    .filter(
      (other) =>
        !PACIFIC_LINKS.some(([a, b]) => (a === id && b === other) || (a === other && b === id)),
    )
    .map((other) => [id, other] as const),
);

/**
 * The three lines over the Pacific leave the map on one side and come back on the other: each
 * is two half-lines, the ones of the straight line to the other city's copy beyond the edge.
 */
const PACIFIC_HALVES = PACIFIC_LINKS.flatMap(([a, b]) => {
  const [west, east] = [cityPoint(a), cityPoint(b)].sort((p, q) => p.x - q.x) as [
    { x: number; y: number },
    { x: number; y: number },
  ];
  const sx = east.x - MAP_WIDTH;
  const lx = west.x + MAP_WIDTH;
  return [
    {
      x1: west.x,
      y1: west.y,
      x2: 0,
      y2: west.y + ((east.y - west.y) * (0 - west.x)) / (sx - west.x),
    },
    {
      x1: east.x,
      y1: east.y,
      x2: MAP_WIDTH,
      y2: east.y + ((west.y - east.y) * (MAP_WIDTH - east.x)) / (lx - east.x),
    },
  ];
});

/** The ocean, the land and the links, drawn under everything else; a tap on any of it is the background. */
function Backdrop({ onClick }: { onClick: (() => void) | undefined }) {
  return (
    <g onClick={onClick}>
      <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill={OCEAN} />
      <path d={WORLD_LAND} fill={LAND} stroke={COAST} strokeWidth={0.6} strokeLinejoin="round" />
      <g stroke={LINK} strokeWidth={1.6} pointerEvents="none">
        {LINKS.map(([a, b]) => {
          const [from, to] = [cityPoint(a), cityPoint(b)];
          return <line key={`${a}-${b}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
        })}
        {PACIFIC_HALVES.map((half, i) => (
          <line key={i} {...half} />
        ))}
      </g>
    </g>
  );
}

/**
 * The world map: the ocean, the land, the links and a dot in each city's color, a name under
 * each city, and a round target on each city for highlights and taps.
 */
export function WorldMap({
  onSelect,
  onBackgroundClick,
  selected = null,
  highlight = null,
  reachable,
  cures,
  hand,
  handHeight = 0,
  children,
}: WorldMapProps) {
  const { t } = useTranslation('pandemic');
  return (
    <svg
      viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT + (hand ? handHeight : 0)}`}
      role="group"
      aria-label={t('map.label')}
      className="h-full w-full select-none"
      preserveAspectRatio="xMidYMid meet"
    >
      <Backdrop onClick={onBackgroundClick} />
      <BoardFurniture />
      {CITIES.map(({ id, color }) => {
        const { x, y } = cityPoint(id);
        return (
          <g
            key={id}
            data-city={id}
            transform={`translate(${x} ${y})`}
            className={onSelect ? 'cursor-pointer' : undefined}
            onClick={onSelect ? () => onSelect(id) : undefined}
          >
            {reachable?.has(id) && (
              <circle
                r={15}
                fill="none"
                stroke="oklch(0.85 0.17 95)"
                strokeWidth={3}
                className="reach-ring"
              />
            )}
            {highlight === id && (
              <circle
                r={21}
                fill="oklch(0.85 0.12 200 / 0.25)"
                stroke="oklch(0.85 0.12 200)"
                strokeWidth={4}
                pointerEvents="none"
              />
            )}
            {selected === id && <circle r={17} fill="none" stroke="white" strokeWidth={3} />}
            <circle
              r={6.5}
              fill={`var(--color-disease-${color})`}
              stroke="white"
              strokeWidth={1.5}
            />
            <circle r={15} fill="transparent" />
            <text
              y={24}
              textAnchor="middle"
              fontSize={11}
              fontWeight={600}
              fill="white"
              stroke="black"
              strokeWidth={2.5}
              paintOrder="stroke"
            >
              {labelLines(cityName(id)).map((line, i) => (
                <tspan key={i} x={0} dy={i === 0 ? 0 : 12}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
      {cures &&
        COLORS.filter((color) => cures[color] !== 'none').map((color) => {
          const { x, top } = CURE_SLOTS[color];
          return (
            <CureMarker
              key={color}
              data-cure={color}
              color={color}
              eradicated={cures[color] === 'eradicated'}
              x={x - CURE_MARKER_WIDTH / 2}
              y={top - CURE_MARKER_INSET}
            />
          );
        })}
      {children}
      {hand && <g transform={`translate(0 ${MAP_HEIGHT})`}>{hand}</g>}
    </svg>
  );
}
