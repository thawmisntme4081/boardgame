import { describe, expect, it } from 'vitest';
import { SEATS } from './index';

describe('shared', () => {
  it('has two seats', () => {
    expect(SEATS).toEqual(['pilot', 'copilot']);
  });
});
