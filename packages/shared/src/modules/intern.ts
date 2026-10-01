import { nextRandom } from '../rng';
import { SLOTS, slotActive } from '../slots';
import type { DieValue, Seat } from '../types';
import type { RuleModule } from './types';

/** The six Intern tokens, numbered 1 to 6. */
export const INTERN_TOKENS: readonly DieValue[] = [1, 2, 3, 4, 5, 6];

/** The token a seat would take next: the one closest to its side of the Intern board. */
export const nextInternToken = (
  tokens: readonly DieValue[] | null,
  seat: Seat,
): DieValue | undefined => (seat === 'pilot' ? tokens?.[0] : tokens?.[tokens.length - 1]);

/**
 * Intern: a die of any value (but not the next token's value) on your Intern space takes
 * the token closest to your side; the token is then placed like a die of its number
 * (no coffee, not on Concentration). Tokens left at the end lose the game.
 */
export const intern: RuleModule = {
  id: 'intern',
  setup(state) {
    // A random face-up token on each space (Fisher–Yates with the game's RNG).
    const tokens = [...INTERN_TOKENS];
    for (let i = tokens.length - 1; i > 0; i--) {
      const r = nextRandom(state.rngState);
      state.rngState = r.rngState;
      const j = Math.floor(r.value * (i + 1));
      [tokens[i], tokens[j]] = [tokens[j]!, tokens[i]!];
    }
    state.intern = tokens;
  },
  checkMove(ctx, intent, value, checkSlot) {
    const token = nextInternToken(ctx.intern, ctx.seat);
    if (token === undefined) return 'no-intern-token';
    if (value === token) return 'intern-same-value';
    const target = intent.tokenSlot;
    if (!target || !slotActive(ctx.scenario.modules, target)) return 'bad-token-slot';
    const group = SLOTS[target].group;
    if (group === 'concentration' || group === 'intern') return 'bad-token-slot';
    return checkSlot(ctx, ctx.seat, target, token);
  },
  place(state, seat, _slot, _value, { tokenSlot, resolve }) {
    const tokens = state.intern!;
    const token = seat === 'pilot' ? tokens.shift() : tokens.pop();
    if (token !== undefined && tokenSlot) resolve(state, seat, tokenSlot, token, 'intern');
    return undefined;
  },
  landingConditions: ['landing-intern'],
  landing(state) {
    return state.intern && state.intern.length > 0 ? ['landing-intern'] : [];
  },
};
