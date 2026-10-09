import type { SeatPresence as Presence } from '@platform/ui/game';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPartnerNotifier, partnerChange } from './presence';

const both = (copilotOnline = true): Presence => ({
  pilot: { name: 'Ana', online: true, creator: false },
  copilot: { name: 'Ben', online: copilotOnline, creator: false },
});
const pilotOnly: Presence = { pilot: both().pilot!, copilot: null };

describe('partnerChange', () => {
  it('spots the partner dropping and coming back', () => {
    expect(partnerChange(both(), both(false), 'pilot')?.kind).toBe('offline');
    expect(partnerChange(both(false), both(), 'pilot')).toEqual({
      seat: 'copilot',
      kind: 'back',
      text: 'Ben is back.',
    });
  });

  it('spots the partner leaving or joining', () => {
    expect(partnerChange(both(), pilotOnly, 'pilot')?.text).toMatch(/^Ben left the game/);
    expect(partnerChange(pilotOnly, both(), 'pilot')?.text).toBe('Ben joined the game.');
  });

  it('ignores the first presence, no change, and your own seat', () => {
    expect(partnerChange(null, both(false), 'pilot')).toBeNull();
    expect(partnerChange(both(), both(), 'pilot')).toBeNull();
    expect(partnerChange(both(), both(false), 'copilot')).toBeNull();
  });
});

describe('createPartnerNotifier', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('says nothing when the partner just refreshes', () => {
    const notify = vi.fn();
    const onPresence = createPartnerNotifier(notify, 3000);
    onPresence(both(), both(false), 'pilot');
    vi.advanceTimersByTime(1000);
    onPresence(both(false), both(), 'pilot');
    vi.advanceTimersByTime(5000);
    expect(notify).not.toHaveBeenCalled();
  });

  it('announces a real drop after the grace period, then the return', () => {
    const notify = vi.fn();
    const onPresence = createPartnerNotifier(notify, 3000);
    onPresence(both(), both(false), 'pilot');
    vi.advanceTimersByTime(2999);
    expect(notify).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(notify).toHaveBeenLastCalledWith(expect.stringMatching(/Ben lost connection/));
    onPresence(both(false), both(), 'pilot');
    expect(notify).toHaveBeenLastCalledWith('Ben is back.');
    expect(notify).toHaveBeenCalledTimes(2);
  });

  it('announces leaving at once and cancels a pending drop', () => {
    const notify = vi.fn();
    const onPresence = createPartnerNotifier(notify, 3000);
    onPresence(both(), both(false), 'pilot');
    onPresence(both(false), pilotOnly, 'pilot');
    vi.advanceTimersByTime(5000);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(expect.stringMatching(/^Ben left the game/));
  });
});
