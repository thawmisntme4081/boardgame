import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeView, presence } from '@/test/fixtures';
import {
  landedScenarios,
  loadHistory,
  MAX_RECORDS,
  recordFor,
  saveRecord,
  scenarioStats,
  type GameRecord,
} from './history';

const game = (over: Partial<GameRecord> = {}): GameRecord => ({
  v: 1,
  scenario: 'yul-green',
  seat: 'pilot',
  partner: 'Ben',
  abilities: [],
  result: 'won',
  reasons: [],
  rounds: 7,
  at: 1,
  ...over,
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('recordFor', () => {
  const playing = makeView('pilot');
  const won = makeView('pilot', { patch: { phase: 'won', round: 7 } });
  const lost = makeView('copilot', {
    patch: { phase: 'lost', round: 3, endReason: 'spin' },
  });

  it('records the change from playing to over, with the partner and the result', () => {
    expect(recordFor(playing, won, presence(), 42)).toEqual({
      v: 1,
      scenario: won.scenario.id,
      seat: 'pilot',
      partner: presence().copilot!.name,
      abilities: [],
      result: 'won',
      reasons: [],
      rounds: 7,
      at: 42,
    });
    expect(recordFor(makeView('copilot'), lost, presence(), 1)).toMatchObject({
      seat: 'copilot',
      partner: presence().pilot!.name,
      result: 'lost',
      reasons: ['spin'],
    });
  });

  it('records nothing for a view sent again after the end, or after a reload', () => {
    expect(recordFor(won, won, presence(), 1)).toBeNull();
    expect(recordFor(null, won, presence(), 1)).toBeNull();
    expect(recordFor(playing, playing, presence(), 1)).toBeNull();
  });
});

describe('storage', () => {
  it('saves newest first and reads it back', () => {
    saveRecord(game({ at: 1 }));
    saveRecord(game({ at: 2, result: 'lost' }));
    expect(loadHistory().map((g) => g.at)).toEqual([2, 1]);
  });

  it(`keeps at most ${MAX_RECORDS} games`, () => {
    localStorage.setItem(
      'sky-team:history',
      JSON.stringify(Array.from({ length: MAX_RECORDS }, (_, i) => game({ at: i }))),
    );
    expect(saveRecord(game({ at: -1 }))).toHaveLength(MAX_RECORDS);
    expect(loadHistory()[0]!.at).toBe(-1);
  });

  it('ignores broken or foreign data', () => {
    localStorage.setItem('sky-team:history', 'not json');
    expect(loadHistory()).toEqual([]);
    localStorage.setItem('sky-team:history', JSON.stringify([game(), { v: 2 }, null]));
    expect(loadHistory()).toHaveLength(1);
  });

  it('keeps playing when storage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(saveRecord(game())).toHaveLength(1);
    expect(loadHistory()).toEqual([]);
  });
});

describe('stats', () => {
  const history = [
    game({ seat: 'pilot', result: 'won' }),
    game({ seat: 'pilot', result: 'lost' }),
    game({ seat: 'copilot', result: 'lost' }),
    game({ scenario: 'lhr-green', seat: 'copilot', result: 'lost' }),
  ];

  it('counts wins and losses per scenario and seat', () => {
    expect(scenarioStats(history)).toEqual({
      'yul-green': { pilot: { won: 1, lost: 1 }, copilot: { won: 0, lost: 1 } },
      'lhr-green': { pilot: { won: 0, lost: 0 }, copilot: { won: 0, lost: 1 } },
    });
  });

  it('lists only the scenarios landed at least once', () => {
    expect([...landedScenarios(history)]).toEqual(['yul-green']);
  });
});
