// What happened after the actions, for the players to read back: the cards drawn, each step of an
// epidemic, every city infected and the outbreaks it set off. Only the current and the previous
// turn are kept, so the state (and every view) stays small. Everything in it is already public
// once it happens: drawn cards go to open hands or out of the game, infection cards to the
// discard pile.
import type { CityId, Color } from './cities';
import type { PlayerCard, SeatId } from './types';

export type LogEntry =
  /** The 2 cards drawn from the player deck, epidemics included. */
  | { type: 'draw'; cards: PlayerCard[] }
  /** Epidemic, Increase: the infection rate is now `rate` cards per turn. */
  | { type: 'epidemic-increase'; rate: number }
  /** Epidemic, Intensify: `cards` infection cards went back on top of the deck. */
  | { type: 'epidemic-intensify'; cards: number }
  /**
   * A city infected, by an infection card or an epidemic's Infect step (`epidemic`): `cubes` put
   * on it (0 when its disease is eradicated or it had no room), and the cities that outbroke as
   * a result, in the order they did (the first is the city itself; the rest are the chain).
   */
  | {
      type: 'infect';
      city: CityId;
      color: Color;
      epidemic: boolean;
      cubes: number;
      eradicated: boolean;
      outbreaks: CityId[];
    };

export interface TurnLog {
  seat: SeatId;
  entries: LogEntry[];
}

export interface GameLog {
  current: TurnLog;
  /** The turn before the current one; `null` during the first turn. */
  previous: TurnLog | null;
}

export const emptyLog = (seat: SeatId): GameLog => ({
  current: { seat, entries: [] },
  previous: null,
});

/** The next player's turn starts: the current turn becomes the previous one. */
export const nextTurnLog = (log: GameLog, seat: SeatId): GameLog => ({
  current: { seat, entries: [] },
  previous: log.current,
});
