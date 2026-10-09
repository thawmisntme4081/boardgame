// What a player may see: everything on the table. Hands are open (the players decided so),
// the decks are only counts (no order, no split of the epidemics), and the seed never leaves.
import type { Viewer } from '@platform/engine';
import type { CityId, Color } from './cities';
import type { GameLog } from './log';
import type {
  ActionState,
  CureState,
  EpidemicStep,
  GameState,
  HandCard,
  LossReason,
  PandemicState,
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
  /** The current and the previous turn's draws, epidemics, infections and outbreaks. */
  log: GameLog;
}

export type { EpidemicStep };

/** Before the game: who is seated, and how many players the game waits for. */
export interface WaitingView {
  status: 'waiting';
  you: SeatId | null;
  seated: SeatId[];
  players: number;
  epidemics: number;
}

/** What a viewer sees of a table: the wait for players, or the game. */
export type TableView = WaitingView | PandemicView;

const viewerSeat = (viewer: Viewer): SeatId | null =>
  (SEATS as readonly string[]).includes(viewer) ? (viewer as SeatId) : null;

/** The view of a table: waiting (no seed), or the game's `viewFor`. */
export function tableViewFor(state: PandemicState, viewer: Viewer): TableView {
  if (state.status !== 'waiting') return viewFor(state, viewer);
  const { seated, players, epidemics } = state;
  return { status: 'waiting', you: viewerSeat(viewer), seated: [...seated], players, epidemics };
}

export function viewFor(state: GameState, viewer: Viewer): PandemicView {
  // Every field is copied by name: a new field of the state is private until it is added here.
  return structuredClone({
    you: viewerSeat(viewer),
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
    log: state.log,
  });
}
