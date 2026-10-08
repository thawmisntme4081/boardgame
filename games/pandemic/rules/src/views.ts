// What a player may see: everything on the table. Hands are open (the players decided so),
// the decks are only counts (no order, no split of the epidemics), and the seed never leaves.
import type { Viewer } from '@platform/engine';
import type { CityId, Color } from './cities';
import type {
  ActionState,
  CureState,
  EpidemicStep,
  GameState,
  HandCard,
  LossReason,
  SeatId,
} from './types';
import { SEATS } from './types';

export interface PandemicView extends ActionState {
  /** The viewer's seat; `null` for someone watching. */
  you: SeatId | null;
  epidemics: number;
  lossReason: LossReason | null;
  supply: Record<Color, number>;
  playerDeckSize: number;
  playerDiscard: HandCard[];
  infectionDeckSize: number;
  infectionDiscard: CityId[];
  outbreaks: number;
  infectionRate: number;
  cures: Record<Color, CureState>;
}

export type { EpidemicStep };

export function viewFor(state: GameState, viewer: Viewer): PandemicView {
  // Every field is copied by name: a new field of the state is private until it is added here.
  return structuredClone({
    you: (SEATS as readonly string[]).includes(viewer) ? (viewer as SeatId) : null,
    seats: state.seats,
    epidemics: state.epidemics,
    turn: state.turn,
    pending: state.pending,
    status: state.status,
    lossReason: state.lossReason,
    pawns: state.pawns,
    hands: state.hands,
    cubes: state.cubes,
    supply: state.supply,
    stations: state.stations,
    playerDeckSize: state.playerDeck.length,
    playerDiscard: state.playerDiscard,
    infectionDeckSize: state.infectionDeck.length,
    infectionDiscard: state.infectionDiscard,
    outbreaks: state.outbreaks,
    infectionRate: state.infectionRate,
    cures: state.cures,
  });
}
