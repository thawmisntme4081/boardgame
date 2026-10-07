// Finished games, saved on this device (guests; an account's log is on the server): the Flight Log and the history list.
import {
  isGameOver,
  otherSeat,
  recordOf,
  type GameRecord,
  type PlayerView,
  type Presence,
  type Seat,
} from '@sky/rules';

export type { GameRecord };

export type WinLoss = { won: number; lost: number };
/** Per scenario: your wins and losses as pilot and as co-pilot. */
export type ScenarioStats = Record<string, Record<Seat, WinLoss>>;

const HISTORY_KEY = 'sky-team:history';
/** Oldest games are dropped beyond this, so storage stays small. */
export const MAX_RECORDS = 500;

export const isRecord = (r: unknown): r is GameRecord => {
  const x = r as Partial<GameRecord> | null;
  return (
    !!x &&
    x.v === 1 &&
    typeof x.scenario === 'string' &&
    (x.seat === 'pilot' || x.seat === 'copilot') &&
    (x.result === 'won' || x.result === 'lost') &&
    typeof x.at === 'number'
  );
};

/** Saved games, newest first. Missing or unreadable storage gives an empty list. */
export function loadHistory(): GameRecord[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isRecord) : [];
  } catch {
    return [];
  }
}

/** Adds a game at the front; storage errors are ignored (the game is simply not kept). */
export function saveRecord(record: GameRecord): GameRecord[] {
  const history = [record, ...loadHistory()].slice(0, MAX_RECORDS);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Private mode or full storage: play goes on without history.
  }
  return history;
}

/**
 * The record for a game that just ended: only on the change from playing to over, so a
 * view sent again (presence, reconnect, reload on the result screen) is not counted twice.
 */
export function recordFor(
  before: PlayerView | null,
  view: PlayerView,
  presence: Presence | null,
  now: number,
): GameRecord | null {
  if (!before || isGameOver(before)) return null;
  return recordOf(view, presence?.[otherSeat(view.seat)]?.name ?? '', now);
}

/** Wins and losses per scenario and seat. */
export function scenarioStats(history: readonly GameRecord[]): ScenarioStats {
  const stats: ScenarioStats = {};
  for (const r of history) {
    const s = (stats[r.scenario] ??= {
      pilot: { won: 0, lost: 0 },
      copilot: { won: 0, lost: 0 },
    });
    s[r.seat][r.result]++;
  }
  return stats;
}

/** Scenarios landed at least once on this device. */
export const landedScenarios = (history: readonly GameRecord[]): Set<string> =>
  new Set(history.filter((r) => r.result === 'won').map((r) => r.scenario));
