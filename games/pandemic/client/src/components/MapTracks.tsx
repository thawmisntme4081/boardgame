import { COLORS, MAX_STATIONS, type Color, type PandemicView } from '@pandemic/rules';
import { useTranslation } from 'react-i18next';
import {
  INFECTION_DECK_FRAME,
  INFECTION_DISCARD_FRAME,
  INFECTION_SLOT_SIZE,
  INFECTION_SLOTS,
  OUTBREAK_SLOT_SIZE,
  OUTBREAK_SLOTS,
  PLAYER_DECK_FRAME,
  PLAYER_DISCARD_FRAME,
  STATION_SUPPLY_SPOT,
  SUPPLY_ICON_SIZE,
  SUPPLY_SPOTS,
  type Frame,
} from '../lib/mapGeometry';
import {
  infectionBackUrl,
  infectionCardUrl,
  playerBackUrl,
  playerCardUrl,
} from '../lib/cardImages';
import { MovingMarker } from './MovingMarker';
import { CubeIcon } from '../svgs/CubeIcon';
import { Station } from '../svgs/Station';
import { InfectionMarker } from '../svgs/InfectionMarker';
import { OutbreakMarker } from '../svgs/OutbreakMarker';

/** The infection marker's disc spans 31 / 32 of its box: scaled to fill a circle of the track. */
const INFECTION_SIZE = (INFECTION_SLOT_SIZE * 32) / 31;
/** The marker's diamond spans 15.4 / 16 of its box on each side: scaled to fill a slot of the track. */
const OUTBREAK_SIZE = (OUTBREAK_SLOT_SIZE * 16) / 15.4;

/** The research station icon is drawn larger than a cube's: its house fills less of its box. */
const STATION_ICON_SIZE = 28;

/** The counters, top to bottom and left to right. */
const SUPPLY_ORDER: readonly Color[] = ['yellow', 'red', 'blue', 'black'];

/** Text that stays readable on the map: white with a dark outline. */
const labelProps = {
  fill: 'white',
  stroke: 'black',
  strokeWidth: 2.5,
  paintOrder: 'stroke',
  fontWeight: 700,
} as const;

/** A pile of cards drawn into a frame of the map picture: the card, and how many are in it. */
function Pile({
  frame,
  href,
  count,
  label,
}: {
  frame: Frame;
  href: string | null;
  count: number;
  label: string;
}) {
  return (
    <g data-pile={label}>
      {href && (
        <image
          href={href}
          x={frame.x}
          y={frame.y}
          width={frame.width}
          height={frame.height}
          preserveAspectRatio="xMidYMid meet"
        />
      )}
      <text
        x={frame.x + frame.width - 4}
        y={frame.y + frame.height - 5}
        textAnchor="end"
        fontSize={15}
        {...labelProps}
      >
        {count}
        <title>{label}</title>
      </text>
    </g>
  );
}

/**
 * The tracks and piles printed on the map picture, drawn from the view: the outbreak marker and
 * the infection rate marker (they slide to the new space), each disease's cubes left, and the
 * decks and discard piles in their frames. Draw it as the map's `children`.
 */
export function MapTracks({ view }: { view: PandemicView }) {
  const { t } = useTranslation('pandemic');
  const outbreak = OUTBREAK_SLOTS[Math.min(view.outbreaks, OUTBREAK_SLOTS.length - 1)];
  const rate = INFECTION_SLOTS[Math.min(view.infectionRate, INFECTION_SLOTS.length - 1)];
  const topInfection = view.infectionDiscard[view.infectionDiscard.length - 1];
  const topPlayer = view.playerDiscard[view.playerDiscard.length - 1];
  return (
    <g pointerEvents="none">
      {outbreak && (
        <MovingMarker x={outbreak.x} y={outbreak.y} turn="flip">
          <OutbreakMarker
            data-outbreaks={view.outbreaks}
            x={-OUTBREAK_SIZE / 2}
            y={-OUTBREAK_SIZE / 2}
            width={OUTBREAK_SIZE}
            height={OUTBREAK_SIZE}
          />
        </MovingMarker>
      )}
      {rate && (
        <MovingMarker x={rate.x} y={rate.y} turn="roll">
          <InfectionMarker
            data-infection-rate={view.infectionRate}
            x={-INFECTION_SIZE / 2}
            y={-INFECTION_SIZE / 2}
            width={INFECTION_SIZE}
            height={INFECTION_SIZE}
          />
        </MovingMarker>
      )}
      {[...COLORS]
        .sort((a, b) => SUPPLY_ORDER.indexOf(a) - SUPPLY_ORDER.indexOf(b))
        .map((color: Color) => {
          const { x, y } = SUPPLY_SPOTS[color];
          return (
            <g key={color} data-supply={color}>
              <CubeIcon
                color={color}
                x={x - SUPPLY_ICON_SIZE / 2}
                y={y - SUPPLY_ICON_SIZE / 2}
                width={SUPPLY_ICON_SIZE}
                height={(SUPPLY_ICON_SIZE * 22) / 20}
              />
              <text x={x + SUPPLY_ICON_SIZE / 2 + 5} y={y + 6} fontSize={14} {...labelProps}>
                {view.supply[color]}
                <title>{t('tracks.supplyOf', { color: t(`color.${color}`) })}</title>
              </text>
            </g>
          );
        })}
      <g data-supply="stations">
        <Station
          x={STATION_SUPPLY_SPOT.x - STATION_ICON_SIZE / 2}
          y={STATION_SUPPLY_SPOT.y - (STATION_ICON_SIZE * 23) / 48}
          width={STATION_ICON_SIZE}
          height={(STATION_ICON_SIZE * 23) / 24}
        />
        <text
          x={STATION_SUPPLY_SPOT.x + STATION_ICON_SIZE / 2 + 5}
          y={STATION_SUPPLY_SPOT.y + 6}
          fontSize={14}
          {...labelProps}
        >
          {MAX_STATIONS - view.stations.length}
          <title>{t('tracks.stationsLeft', { count: MAX_STATIONS - view.stations.length })}</title>
        </text>
      </g>
      <Pile
        frame={INFECTION_DECK_FRAME}
        href={view.infectionDeckSize > 0 ? infectionBackUrl() : null}
        count={view.infectionDeckSize}
        label={t('tracks.infectionDeck', { count: view.infectionDeckSize })}
      />
      <Pile
        frame={INFECTION_DISCARD_FRAME}
        href={topInfection ? infectionCardUrl(topInfection) : null}
        count={view.infectionDiscard.length}
        label={t('tracks.infectionDiscard', { count: view.infectionDiscard.length })}
      />
      <Pile
        frame={PLAYER_DISCARD_FRAME}
        href={topPlayer ? playerCardUrl(topPlayer) : null}
        count={view.playerDiscard.length}
        label={t('tracks.playerDiscard', { count: view.playerDiscard.length })}
      />
      <Pile
        frame={PLAYER_DECK_FRAME}
        href={view.playerDeckSize > 0 ? playerBackUrl() : null}
        count={view.playerDeckSize}
        label={t('tracks.playerDeck', { count: view.playerDeckSize })}
      />
    </g>
  );
}
