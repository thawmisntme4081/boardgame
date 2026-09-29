import {
  createGame,
  rollDice,
  viewFor,
  YUL,
  type DieValue,
  type GameState,
  type PlayerView,
  type Presence,
  type Seat,
} from '@sky/shared';
import { useGame } from '@/store';

/** A real game state turned into a player's view, with fixed dice. */
export function makeView(
  seat: Seat,
  opts: {
    pilot?: DieValue[];
    copilot?: DieValue[];
    patch?: Partial<GameState>;
    rolled?: boolean;
  } = {},
): PlayerView {
  let state = createGame(YUL, 1);
  if (opts.rolled !== false) {
    state = rollDice(state);
    state.dice = {
      pilot: (opts.pilot ?? [2, 3, 4, 5]).map((value, i) => ({ id: `p${i + 1}`, value })),
      copilot: (opts.copilot ?? [2, 3, 4, 5]).map((value, i) => ({ id: `c${i + 1}`, value })),
    };
  }
  return viewFor({ ...state, ...opts.patch }, seat);
}

export const presence = (pilotReady = false, copilotReady = false): Presence => ({
  pilot: { name: 'Ana', online: true, ready: pilotReady },
  copilot: { name: 'Ben', online: true, ready: copilotReady },
});

export function resetStore(): void {
  useGame.setState({
    connection: 'online',
    session: null,
    view: null,
    presence: null,
    selectedDieId: null,
    coffeeDelta: 0,
    rerollPick: [],
    roundDeadline: null,
    nextTurnAt: null,
  });
}
