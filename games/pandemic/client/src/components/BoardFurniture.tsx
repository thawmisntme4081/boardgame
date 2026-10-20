import { COLORS, INFECTION_RATES, MAX_OUTBREAKS, type Color } from '@pandemic/rules';
import { Skull } from 'lucide-react';
import {
  BOARD_BOTTOM,
  CURE_SLOTS,
  INFECTION_DECK_FRAME,
  INFECTION_DISCARD_FRAME,
  INFECTION_SLOTS,
  INFECTION_SLOT_SIZE,
  OUTBREAK_SLOTS,
  OUTBREAK_SLOT_SIZE,
  PLAYER_DECK_FRAME,
  PLAYER_DISCARD_FRAME,
  type Frame,
} from '../lib/mapGeometry';
import { CURE_MARKER_WIDTH } from '../svgs/CureMarker';

const PANEL = 'oklch(0.2 0.03 250 / 0.82)';
const PANEL_LINE = 'oklch(0.85 0.02 250 / 0.55)';
const GREEN = 'oklch(0.7 0.17 150)';

/** The supply panel: the research station and cube counters sit on it (`MapTracks` draws them). */
const SUPPLY_PANEL: Frame = { x: 403.5, y: 606, width: 174, height: BOARD_BOTTOM - 606 };

const numberProps = {
  textAnchor: 'middle',
  dominantBaseline: 'central',
  fontWeight: 700,
  fill: 'white',
} as const;

/** A card pile's place: a dashed rounded frame on a dark panel. */
export function PileFrame({ frame, stroke }: { frame: Frame; stroke: string }) {
  return (
    <rect
      x={frame.x}
      y={frame.y}
      width={frame.width}
      height={frame.height}
      rx={8}
      fill={PANEL}
      stroke={stroke}
      strokeWidth={2}
      strokeDasharray="6 4"
    />
  );
}

/**
 * What the board prints around the map itself, drawn in SVG at the places `lib/mapGeometry.ts`
 * holds: the outbreak track (the last space is the skull), the infection rate track, the four
 * cure slots, the supply panel and the places of the four card piles. It is only the board's
 * paint: the markers, counters and piles that sit on it are `MapTracks`'.
 */
export function BoardFurniture() {
  const half = OUTBREAK_SLOT_SIZE / 2;
  return (
    <g pointerEvents="none" aria-hidden="true">
      {/* Outbreak track: a column of diamonds, 0 to the skull (8). */}
      {OUTBREAK_SLOTS.length > 1 && (
        <polyline
          points={OUTBREAK_SLOTS.map(({ x, y }) => `${x},${y}`).join(' ')}
          fill="none"
          stroke={PANEL_LINE}
          strokeWidth={3}
          strokeLinejoin="round"
        />
      )}
      {OUTBREAK_SLOTS.map(({ x, y }, i) => {
        const skull = i === MAX_OUTBREAKS;
        return (
          <g key={i} data-outbreak-slot={i}>
            <path
              d={`M${x} ${y - half}L${x + half} ${y}L${x} ${y + half}L${x - half} ${y}Z`}
              fill={skull ? 'oklch(0.5 0.2 25)' : PANEL}
              stroke={skull ? 'white' : PANEL_LINE}
              strokeWidth={2}
              strokeLinejoin="round"
            />
            {skull ? (
              <Skull x={x - 9} y={y - 9} width={18} height={18} color="white" strokeWidth={2} />
            ) : (
              <text x={x} y={y} fontSize={13} {...numberProps}>
                {i}
              </text>
            )}
          </g>
        );
      })}

      {/* Infection rate track: seven circles with the cards drawn at each. */}
      <rect
        x={INFECTION_SLOTS[0]!.x - INFECTION_SLOT_SIZE / 2 - 6}
        y={INFECTION_SLOTS[0]!.y - INFECTION_SLOT_SIZE / 2 - 6}
        width={
          INFECTION_SLOTS[INFECTION_SLOTS.length - 1]!.x -
          INFECTION_SLOTS[0]!.x +
          INFECTION_SLOT_SIZE +
          12
        }
        height={INFECTION_SLOT_SIZE + 12}
        rx={(INFECTION_SLOT_SIZE + 12) / 2}
        fill={PANEL}
        stroke={GREEN}
        strokeWidth={2}
      />
      {INFECTION_SLOTS.map(({ x, y }, i) => (
        <g key={i} data-infection-slot={i}>
          <circle
            cx={x}
            cy={y}
            r={INFECTION_SLOT_SIZE / 2 - 2}
            fill="oklch(0.3 0.08 150)"
            stroke={GREEN}
            strokeWidth={1.5}
          />
          <text x={x} y={y} fontSize={16} {...numberProps}>
            {INFECTION_RATES[i]}
          </text>
        </g>
      ))}

      {/* The four cure slots, in their disease colors. */}
      {COLORS.map((color: Color) => {
        const { x, top } = CURE_SLOTS[color];
        return (
          <rect
            key={color}
            data-cure-slot={color}
            x={x - CURE_MARKER_WIDTH / 2 - 5}
            y={top - 4}
            width={CURE_MARKER_WIDTH + 10}
            height={BOARD_BOTTOM - (top - 4)}
            rx={7}
            fill={PANEL}
            // Black on a dark panel would vanish: its outline is a light gray.
            stroke={color === 'black' ? 'oklch(0.7 0.02 260)' : `var(--color-disease-${color})`}
            strokeWidth={2.5}
          />
        );
      })}

      <rect
        x={SUPPLY_PANEL.x}
        y={SUPPLY_PANEL.y}
        width={SUPPLY_PANEL.width}
        height={SUPPLY_PANEL.height}
        rx={10}
        fill={PANEL}
        stroke={PANEL_LINE}
        strokeWidth={1.5}
      />

      <PileFrame frame={INFECTION_DECK_FRAME} stroke={GREEN} />
      <PileFrame frame={INFECTION_DISCARD_FRAME} stroke={GREEN} />
      <PileFrame frame={PLAYER_DECK_FRAME} stroke="white" />
      <PileFrame frame={PLAYER_DISCARD_FRAME} stroke="white" />
    </g>
  );
}
