import {
  createGame,
  rollDice,
  SCENARIO_LIST,
  SCENARIOS,
  viewFor,
  YUL,
  type AbilityId,
  type Scenario,
  type DieValue,
  type GameState,
  type PlayerView,
  type Presence,
  type Seat,
} from '@sky/shared';
import { useGame } from '@/store';

export function makeView(
  seat: Seat,
  opts: {
    pilot?: DieValue[];
    copilot?: DieValue[];
    patch?: Partial<GameState>;
    rolled?: boolean;
    /** A scenario id, or YUL with these fields replaced (e.g. `{ modules: ['intern'] }`). */
    scenario?: string | Partial<Scenario>;
    abilities?: AbilityId[];
  } = {},
): PlayerView {
  const scenario =
    typeof opts.scenario === 'string'
      ? SCENARIOS[opts.scenario]!
      : opts.scenario
        ? { ...YUL, id: 'test', ...opts.scenario }
        : YUL;
  let state = createGame(scenario, 1, {
    abilities: opts.abilities ?? [],
  });
  if (opts.rolled !== false) {
    state = rollDice(state);
    state.dice = {
      pilot: (opts.pilot ?? [2, 3, 4, 5]).map((value, i) => ({ id: `p${i + 1}`, value })),
      copilot: (opts.copilot ?? [2, 3, 4, 5]).map((value, i) => ({ id: `c${i + 1}`, value })),
    };
  }
  return viewFor({ ...state, ...opts.patch }, seat);
}

/** The first active scenario that matches, for tests that need a real (selectable) one. */
export function catalogScenario(match: (s: Scenario) => boolean): Scenario {
  const found = SCENARIO_LIST.find(match);
  if (!found) throw new Error('no active scenario matches this test');
  return found;
}

export const presence = (pilotReady = false, copilotReady = false): Presence => ({
  pilot: {
    name: 'Ana',
    online: true,
    ready: pilotReady,
    creator: false,
    pick: null,
    rolesChosen: true,
    confirmed: false,
  },
  copilot: {
    name: 'Ben',
    online: true,
    ready: copilotReady,
    creator: false,
    pick: null,
    rolesChosen: true,
    confirmed: false,
  },
});

export function resetStore(): void {
  useGame.setState({
    connection: 'online',
    session: null,
    view: null,
    presence: null,
    selectedDieId: null,
    coffeeDelta: 0,
    internSlot: null,
    rerollPick: [],
    roundDeadline: null,
    nextTurnAt: null,
    history: [],
    siteAccess: 'open',
  });
}
