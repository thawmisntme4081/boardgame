import { COLORS, MAX_STATIONS, type Color, type PandemicView } from '@pandemic/rules';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CONTINGENCY_FRAME,
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
import { useInfectionPile } from '../lib/infectionDraw';
import { usePandemic } from '../store';
import type { DealProgress } from '../lib/deal';
import { DeckBuild } from './DeckBuild';
import { EpidemicCard } from './EpidemicCard';
import { ShuffleFlight } from './ShuffleFlight';
import { InfectionDrawFlight, INFECTION_DRAW_MS } from './InfectionDrawFlight';
import { MovingMarker } from './MovingMarker';
import { handFace } from '../lib/cards';
import { Card, type CardFace } from '../svgs/Card';
import { PileFrame } from './BoardFurniture';
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

/** A pile of cards drawn into one of the board's frames (`BoardFurniture`): the card, and how many are in it. */
function Pile({
  frame,
  face,
  count,
  label,
}: {
  frame: Frame;
  face: CardFace | null;
  /** How many cards are in the pile; `null` for a place that holds at most one. */
  count: number | null;
  label: string;
}) {
  return (
    <g data-pile={label}>
      {face && (
        <Card face={face} x={frame.x} y={frame.y} width={frame.width} height={frame.height} />
      )}
      {count === null ? (
        <title>{label}</title>
      ) : (
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
      )}
    </g>
  );
}

/**
 * What sits on the board's tracks and frames (`BoardFurniture`), drawn from the view: the outbreak marker and
 * the infection rate marker (they slide to the new space), each disease's cubes left, and the
 * decks and discard piles in their frames. Draw it as the map's `children`.
 */
export function MapTracks({
  view,
  deal = null,
}: {
  view: PandemicView;
  /** The deal being played: its last part builds the player deck in its epidemic piles. */
  deal?: DealProgress | null;
}) {
  const { t } = useTranslation('pandemic');
  const outbreak = OUTBREAK_SLOTS[Math.min(view.outbreaks, OUTBREAK_SLOTS.length - 1)];
  const rate = INFECTION_SLOTS[Math.min(view.infectionRate, INFECTION_SLOTS.length - 1)];
  const { shown: infectionDiscard, flights } = useInfectionPile(
    view.infectionDiscard,
    INFECTION_DRAW_MS,
  );
  const topInfection = infectionDiscard[infectionDiscard.length - 1];
  const openPile = usePandemic((s) => s.openPile);
  // An epidemic being resolved: its card lies on the player pile, highlighted.
  const epidemic =
    view.status === 'playing' && view.turn.step === 'epidemic' && view.turn.epidemics > 0;
  // The infection discard pile emptied onto the deck (Intensify): the shuffle is played once.
  const [pileSize, setPileSize] = useState(view.infectionDiscard.length);
  const [shuffles, setShuffles] = useState<{ id: number; cards: number }[]>([]);
  if (pileSize !== view.infectionDiscard.length) {
    setPileSize(view.infectionDiscard.length);
    if (pileSize > 0 && view.infectionDiscard.length === 0) {
      setShuffles((list) => [...list, { id: (list.at(-1)?.id ?? 0) + 1, cards: pileSize }]);
    }
  }
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
      {/* The Contingency Planner's stored event card: a place for it only while that role plays. */}
      {Object.values(view.roles).includes('contingency-planner') && (
        <>
          <PileFrame frame={CONTINGENCY_FRAME} stroke="white" />
          <Pile
            frame={CONTINGENCY_FRAME}
            face={view.contingency ? { kind: 'event', event: view.contingency } : null}
            count={null}
            label={t('tracks.contingencyCard')}
          />
        </>
      )}
      <Pile
        frame={INFECTION_DECK_FRAME}
        face={view.infectionDeckSize > 0 ? { kind: 'back', deck: 'infection' } : null}
        count={view.infectionDeckSize}
        label={t('tracks.infectionDeck', { count: view.infectionDeckSize })}
      />
      <Pile
        frame={INFECTION_DISCARD_FRAME}
        face={topInfection ? { kind: 'infection', city: topInfection } : null}
        count={infectionDiscard.length}
        label={t('tracks.infectionDiscard', { count: infectionDiscard.length })}
      />
      {flights.map((flight) => (
        <InfectionDrawFlight key={flight.key} city={flight.city} />
      ))}
      <Pile
        frame={PLAYER_DISCARD_FRAME}
        face={epidemic ? { kind: 'epidemic' } : topPlayer ? handFace(topPlayer) : null}
        count={view.playerDiscard.length}
        label={t('tracks.playerDiscard', { count: view.playerDiscard.length })}
      />
      {deal && deal.piles !== 0 && <DeckBuild epidemics={view.epidemics} stage={deal.piles} />}
      <Pile
        frame={PLAYER_DECK_FRAME}
        // The deck is taken apart into its piles while they are built.
        face={
          view.playerDeckSize > 0 && deal?.piles !== 1 && deal?.piles !== 2
            ? { kind: 'back', deck: 'player' }
            : null
        }
        count={view.playerDeckSize}
        label={t('tracks.playerDeck', { count: view.playerDeckSize })}
      />
      {epidemic && <EpidemicCard key={view.turn.epidemics} count={view.turn.epidemics} />}
      {shuffles.map(({ id, cards }) => (
        <ShuffleFlight
          key={id}
          cards={cards}
          onDone={() => setShuffles((list) => list.filter((item) => item.id !== id))}
        />
      ))}
      {/* The two discard piles can be pressed to list their cards. */}
      {(
        [
          ['player', PLAYER_DISCARD_FRAME, t('tracks.openPlayerDiscard')],
          ['infection', INFECTION_DISCARD_FRAME, t('tracks.openInfectionDiscard')],
        ] as const
      ).map(([pile, frame, label]) => (
        <rect
          key={pile}
          x={frame.x}
          y={frame.y}
          width={frame.width}
          height={frame.height}
          fill="transparent"
          pointerEvents="all"
          className="cursor-pointer"
          role="button"
          tabIndex={0}
          aria-label={label}
          onClick={() => openPile(pile)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openPile(pile);
            }
          }}
        />
      ))}
    </g>
  );
}
