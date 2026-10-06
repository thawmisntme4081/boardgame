import { seatInfo, type SeatPresence } from '@platform/ui/game';
import { beforeEach, describe, expect, it } from 'vitest';
import { usePlatform } from './store';
import { resetStore } from './test/fixtures';

beforeEach(resetStore);

const presence = (): SeatPresence => ({
  pilot: { name: 'Ana', online: true, creator: true },
  copilot: { name: 'Ben', online: true, creator: false },
});
const match = (seat: string) => ({ matchId: 'ABCD-1-a', version: 1, seat, view: { seat } });
const nameIn = (seat: string) => seatInfo(usePlatform.getState().presence, seat)?.name;

describe('platform store', () => {
  it('clears the room on leave', () => {
    usePlatform.setState({
      session: { code: 'ABCD', game: 'sky-team', token: 't', seat: 'pilot', name: 'Ana' },
      match: match('pilot'),
      presence: presence(),
    });
    usePlatform.getState().leave();
    expect(usePlatform.getState()).toMatchObject({ session: null, match: null, presence: null });
  });
});

describe('presence across a seat change', () => {
  it('waits for the view of the new seat before showing the new presence', () => {
    const before = presence();
    // Ana created the game as the pilot, then took the co-pilot seat.
    const swapped: SeatPresence = {
      pilot: seatInfo(before, 'copilot')!,
      copilot: seatInfo(before, 'pilot')!,
      you: 'copilot',
    };
    usePlatform.getState().setMatch(match('pilot'));
    usePlatform.getState().setPresence({ ...before, you: 'pilot' });

    usePlatform.getState().setPresence(swapped);
    // Still the pilot's view: the old presence stays, so the partner is still Ben.
    expect(nameIn('copilot')).toBe('Ben');

    usePlatform.getState().setMatch(match('copilot'));
    expect(usePlatform.getState().presence).toBe(swapped);
    expect(nameIn('pilot')).toBe('Ben');
  });
});
