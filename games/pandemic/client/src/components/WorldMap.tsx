import { COLORS, CITIES, type CityId, type Color, type CureState } from '@pandemic/rules';
import type { ReactNode } from 'react';
import mapUrl from '../assets/map.webp';
import { CURE_SLOTS, MAP_HEIGHT, MAP_WIDTH, cityPoint } from '../lib/mapGeometry';
import { cityName } from '../lib/names';
import { CURE_MARKER_INSET, CURE_MARKER_WIDTH, CureMarker } from '../svgs/CureMarker';

export interface WorldMapProps {
  onSelect?: (city: CityId) => void;
  /** Tapping the sea, a continent or any spot that is not a city. */
  onBackgroundClick?: () => void;
  selected?: CityId | null;
  reachable?: ReadonlySet<CityId>;
  /** A vial in the disease slot once cured (gold outline when eradicated). */
  cures?: Record<Color, CureState>;
  children?: ReactNode;
}

/**
 * The world map: the picture (it already draws the links and the cities' icons), a name under
 * each city, and a round target on each city for highlights and taps.
 */
export function WorldMap({
  onSelect,
  onBackgroundClick,
  selected = null,
  reachable,
  cures,
  children,
}: WorldMapProps) {
  return (
    <svg
      viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
      role="group"
      aria-label="Map"
      className="h-full w-full select-none"
      preserveAspectRatio="xMidYMid meet"
    >
      <image href={mapUrl} width={MAP_WIDTH} height={MAP_HEIGHT} onClick={onBackgroundClick} />
      {CITIES.map(({ id }) => {
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
              <circle r={15} fill="none" stroke="oklch(0.85 0.17 95)" strokeWidth={2}>
                <animate attributeName="r" values="14;15;14" dur="1.4s" repeatCount="indefinite" />
                <animate
                  attributeName="opacity"
                  values="1;0.55;1"
                  dur="1.4s"
                  repeatCount="indefinite"
                />
              </circle>
            )}
            {selected === id && <circle r={17} fill="none" stroke="white" strokeWidth={3} />}
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
              {cityName(id)}
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
    </svg>
  );
}
