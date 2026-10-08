import { describe, expect, it } from 'vitest';
import { GAME_ID } from './index';

describe('@pandemic/rules', () => {
  it('names the game', () => {
    expect(GAME_ID).toBe('pandemic');
  });
});
