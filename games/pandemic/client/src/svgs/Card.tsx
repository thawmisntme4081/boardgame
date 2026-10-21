import { cityOf, type CityId, type Color, type EventId } from '@pandemic/rules';
import { Biohazard, Eye, Globe, Landmark, Moon, Plane, ShieldCheck } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { useTranslation } from 'react-i18next';
import { INFECTION_CARD, PLAYER_CARD } from '../lib/cardSizes';
import { CubeIcon } from './CubeIcon';
import { cityName, labelLines } from '../lib/names';

/** What a card shows: a player card, an infection card, or the back of either deck. */
export type CardFace =
  | { kind: 'city'; city: CityId }
  | { kind: 'event'; event: EventId }
  | { kind: 'epidemic' }
  | { kind: 'infection'; city: CityId }
  | { kind: 'back'; deck: 'player' | 'infection' };

const PAPER = 'oklch(0.97 0.01 95)';
const INK = 'oklch(0.22 0.02 250)';
const EVENT = 'oklch(0.52 0.13 150)';
const EPIDEMIC = 'oklch(0.42 0.2 25)';
const INFECTION_BACK = 'oklch(0.34 0.09 150)';
const PLAYER_BACK = 'oklch(0.3 0.07 250)';

/** Text on a disease color: dark on the light yellow. */
const onColor = (color: Color): string => (color === 'yellow' ? INK : 'white');

const diseaseColor = (color: Color): string => `var(--color-disease-${color})`;

/** The average width of a letter, as a part of the font size (bold text is wider). */
const WIDTH = { regular: 0.52, bold: 0.6 } as const;

/** Words onto lines no wider than `width`, guessing each letter's width from the font size. */
function wrap(text: string, width: number, fontSize: number): string[] {
  const limit = Math.max(1, Math.floor(width / (fontSize * WIDTH.regular)));
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && next.length > limit) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** The largest font size (down to `min`) at which `text` fits the box, with its lines. */
function fitParagraph(text: string, width: number, height: number, max: number, min: number) {
  for (let size = max; size > min; size -= 0.5) {
    const lines = wrap(text, width, size);
    if (lines.length * size * 1.25 <= height) return { lines, size };
  }
  return { lines: wrap(text, width, min), size: min };
}

/** A city's name on one or two lines (`labelLines`), the font shrunk until the longest fits. */
function fitName(name: string, width: number, size: number) {
  const lines = labelLines(name);
  const longest = Math.max(...lines.map((line) => line.length));
  return { lines, size: Math.min(size, width / (longest * WIDTH.bold)) };
}

/** Lines of text centered on `x`, the first line's middle at `y`. */
function Lines({
  lines,
  x,
  y,
  size,
  fill,
  weight = 700,
  anchor = 'middle',
}: {
  lines: string[];
  x: number;
  y: number;
  size: number;
  fill: string;
  weight?: number;
  anchor?: 'start' | 'middle';
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={size}
      fontWeight={weight}
      fill={fill}
      textAnchor={anchor}
      dominantBaseline="central"
    >
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : size * 1.25}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

type IconType = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;

const EVENT_ICONS: Record<EventId, IconType> = {
  airlift: Plane,
  forecast: Eye,
  'government-grant': Landmark,
  'one-quiet-night': Moon,
  'resilient-population': ShieldCheck,
};

/** A card's outline: rounded paper with a thin dark edge. */
function Base({ width, height, fill = PAPER }: { width: number; height: number; fill?: string }) {
  return (
    <rect
      x={1}
      y={1}
      width={width - 2}
      height={height - 2}
      rx={14}
      fill={fill}
      stroke={INK}
      strokeWidth={2}
    />
  );
}

/** A band across the top of a card, with its small title. */
function Band({
  width,
  height,
  fill,
  text,
  title,
  radius = 14,
}: {
  width: number;
  height: number;
  fill: string;
  text: string;
  title: string;
  /** The corner rounding of the card the band sits on. */
  radius?: number;
}) {
  return (
    <>
      <path
        d={`M0 ${height}V${radius}Q0 0 ${radius} 0H${width - radius}Q${width} 0 ${width} ${radius}V${height}Z`}
        fill={fill}
      />
      <Lines lines={[title]} x={width / 2} y={height / 2 + 1} size={17} fill={text} />
    </>
  );
}

function CityFace({ city }: { city: CityId }) {
  const { t } = useTranslation('pandemic');
  const { width, height } = PLAYER_CARD;
  const { color } = cityOf(city);
  const name = fitName(cityName(city), width - 28, 31);
  return (
    <>
      <Base width={width} height={height} />
      <g transform="translate(1 1)">
        <Band
          width={width - 2}
          height={63}
          fill={diseaseColor(color)}
          text={onColor(color)}
          radius={13}
          title={t(`color.${color}`).toUpperCase()}
        />
      </g>
      <Lines
        lines={name.lines}
        x={width / 2}
        y={name.lines.length > 1 ? 108 : 124}
        size={name.size}
        fill={INK}
      />
      {/* Three cubes of the disease, stacked: the city's infection in the game's own pieces. */}
      {[
        [width / 2 - 46, 226],
        [width / 2 + 2, 226],
        [width / 2 - 22, 190],
      ].map(([x, y], i) => (
        <CubeIcon key={i} color={color} x={x} y={y} width={44} height={48} />
      ))}
    </>
  );
}

function EventFace({ event }: { event: EventId }) {
  const { t } = useTranslation('pandemic');
  const { width, height } = PLAYER_CARD;
  const Icon = EVENT_ICONS[event];
  const name = fitName(t(`events.${event}`), width - 24, 22);
  const effect = fitParagraph(t(`eventInfo.${event}`), width - 28, 104, 14, 8);
  return (
    <>
      <Base width={width} height={height} />
      <g transform="translate(1 1)">
        <Band
          width={width - 2}
          height={43}
          fill={EVENT}
          text="white"
          radius={13}
          title={t('cards.event').toUpperCase()}
        />
      </g>
      <Icon x={width / 2 - 18} y={54} width={36} height={36} color={EVENT} strokeWidth={2} />
      <Lines lines={name.lines} x={width / 2} y={110} size={name.size} fill={INK} />
      <Lines
        lines={effect.lines}
        x={width / 2}
        y={name.lines.length > 1 ? 170 : 150}
        size={effect.size}
        fill={INK}
        weight={500}
      />
    </>
  );
}

function EpidemicFace() {
  const { t } = useTranslation('pandemic');
  const { width, height } = PLAYER_CARD;
  const steps = ['increase', 'infect', 'intensify'] as const;
  return (
    <>
      <Base width={width} height={height} fill={EPIDEMIC} />
      <rect x={10} y={10} width={width - 20} height={height - 20} rx={9} fill={PAPER} />
      <g transform="translate(10 10)">
        <Band
          width={width - 20}
          height={52}
          fill={EPIDEMIC}
          text="white"
          radius={9}
          title={t('cards.epidemic').toUpperCase()}
        />
        <Biohazard
          x={width / 2 - 40}
          y={62}
          width={60}
          height={60}
          color={EPIDEMIC}
          strokeWidth={1.8}
        />
      </g>
      {steps.map((step, i) => {
        const label = fitName(t(`board.epidemicStep.${step}`), 128, 21);
        return (
          <g key={step}>
            <circle cx={42} cy={168 + i * 38} r={13} fill={EPIDEMIC} />
            <Lines lines={[String(i + 1)]} x={42} y={168 + i * 38} size={15} fill="white" />
            <Lines
              lines={[label.lines.join(' ')]}
              x={64}
              y={168 + i * 38}
              size={Math.min(label.size, 19)}
              fill={INK}
              anchor="start"
            />
          </g>
        );
      })}
    </>
  );
}

function InfectionFace({ city }: { city: CityId }) {
  const { t } = useTranslation('pandemic');
  const { width, height } = INFECTION_CARD;
  const { color } = cityOf(city);
  // The name at the top of the body, three small cubes of the disease at the bottom. A name
  // on two lines is a little smaller.
  const full = fitName(cityName(city), width - 40, 34);
  const name = full.lines.length > 1 ? { ...full, size: Math.min(full.size, 26) } : full;
  return (
    <>
      <Base width={width} height={height} fill={diseaseColor(color)} />
      <rect x={10} y={10} width={width - 20} height={height - 20} rx={9} fill={PAPER} />
      <g transform="translate(10 10)">
        <Band
          width={width - 20}
          height={40}
          fill={diseaseColor(color)}
          text={onColor(color)}
          radius={9}
          title={t('cards.infection').toUpperCase()}
        />
      </g>
      <Lines
        lines={name.lines}
        x={width / 2}
        y={name.lines.length > 1 ? 72 : 84}
        size={name.size}
        fill={INK}
      />
      {[-66, -20, 26].map((dx, i) => (
        <CubeIcon key={i} color={color} x={width / 2 + dx} y={136} width={40} height={44} />
      ))}
    </>
  );
}

/** The back of a deck: a colored card with a double edge and an emblem. */
function BackFace({
  deck,
  width,
  height,
}: {
  deck: 'player' | 'infection';
  width: number;
  height: number;
}) {
  const fill = deck === 'player' ? PLAYER_BACK : INFECTION_BACK;
  const Emblem = deck === 'player' ? Globe : Biohazard;
  const size = Math.min(width, height) * 0.4;
  return (
    <>
      <Base width={width} height={height} fill={fill} />
      <rect
        x={10}
        y={10}
        width={width - 20}
        height={height - 20}
        rx={9}
        fill="none"
        stroke="white"
        strokeOpacity={0.55}
        strokeWidth={2}
      />
      <circle cx={width / 2} cy={height / 2} r={size * 0.78} fill="white" fillOpacity={0.1} />
      <Emblem
        x={width / 2 - size / 2}
        y={height / 2 - size / 2}
        width={size}
        height={size}
        color="white"
        strokeWidth={1.6}
      />
    </>
  );
}

/**
 * One card, drawn in SVG at any size (`width` × `height` keep the card's own proportions: a
 * player card 208 × 290, an infection card 279 × 200). Nest it in the map's <svg> or use it
 * alone; it needs no picture, and its names come in the player's language.
 */
export function Card({
  face,
  width,
  height,
  title,
  ...props
}: {
  face: CardFace;
  width?: number;
  height?: number;
  /** A tooltip (and what a screen reader says when the card has a role). */
  title?: string;
} & Omit<SVGProps<SVGSVGElement>, 'width' | 'height' | 'viewBox' | 'children'>) {
  const wide = face.kind === 'infection' || (face.kind === 'back' && face.deck === 'infection');
  const box = wide ? INFECTION_CARD : PLAYER_CARD;
  return (
    <svg
      viewBox={`0 0 ${box.width} ${box.height}`}
      width={width ?? box.width}
      height={height ?? box.height}
      data-card={face.kind}
      {...props}
    >
      {title && <title>{title}</title>}
      {face.kind === 'city' && <CityFace city={face.city} />}
      {face.kind === 'event' && <EventFace event={face.event} />}
      {face.kind === 'epidemic' && <EpidemicFace />}
      {face.kind === 'infection' && <InfectionFace city={face.city} />}
      {face.kind === 'back' && <BackFace deck={face.deck} width={box.width} height={box.height} />}
    </svg>
  );
}
