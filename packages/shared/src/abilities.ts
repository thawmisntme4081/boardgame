// Special Ability cards. Control, Mastery and Synchronization trigger by themselves in
// `rules.ts`; the three below are actions a player takes.
import { rollDie } from './rng';
import { currentAltitude, isGameOver, otherSeat, RuleError, settleTurn } from './rules';
import type {
  AbilityAction,
  AbilityId,
  AbilityUse,
  Die,
  DieValue,
  GameState,
  MoveCheck,
  MoveError,
  Phase,
  PlacedDie,
  Seat,
  SlotId,
} from './types';

export const ABILITY_IDS: readonly AbilityId[] = [
  'adaptation',
  'anticipation',
  'control',
  'mastery',
  'synchronization',
  'working-together',
];

export const freshAbilityUse = (): AbilityUse => ({
  adaptation: { pilot: false, copilot: false },
  anticipation: false,
  workingTogether: false,
  synchronization: false,
});

/** What an ability check reads: built from `GameState` here, or from a `PlayerView` on the client. */
export interface AbilityContext {
  seat: Seat;
  phase: Phase;
  abilities: readonly AbilityId[];
  abilityUse: AbilityUse;
  bonus: object | null;
  swap: { seat: Seat } | null;
  placed: Partial<Record<SlotId, PlacedDie>>;
  myDice: readonly Die[];
  partnerDiceLeft: number;
  /** The round's first player (arrow on the altitude track). */
  firstSeat: Seat;
}

export const abilityContext = (state: GameState, seat: Seat): AbilityContext => ({
  seat,
  phase: state.phase,
  abilities: state.abilities,
  abilityUse: state.abilityUse,
  bonus: state.bonus,
  swap: state.swap,
  placed: state.placed,
  myDice: state.dice[seat],
  partnerDiceLeft: state.dice[otherSeat(seat)].length,
  firstSeat: currentAltitude(state).first,
});

const fail = (reason: MoveError): MoveCheck => ({ ok: false, reason });
const OK: MoveCheck = { ok: true };

export function checkAbility(ctx: AbilityContext, action: AbilityAction): MoveCheck {
  if (isGameOver(ctx)) return fail('game-over');
  if (ctx.phase !== 'placing') return fail('not-placing');
  if (!ctx.abilities.includes(action.ability)) return fail('ability-unavailable');
  if (ctx.bonus) return fail('bonus-pending');
  if (!ctx.myDice.some((d) => d.id === action.dieId)) return fail('unknown-die');
  switch (action.ability) {
    case 'adaptation':
      if (ctx.swap) return fail('swap-pending');
      return ctx.abilityUse.adaptation[ctx.seat] ? fail('ability-used') : OK;
    case 'anticipation':
      if (ctx.swap) return fail('swap-pending');
      if (ctx.abilityUse.anticipation) return fail('ability-used');
      if (ctx.seat !== ctx.firstSeat) return fail('not-first-player');
      if (Object.values(ctx.placed).some((p) => p.seat === ctx.seat)) {
        return fail('first-die-placed');
      }
      return OK;
    case 'working-together':
      // Answering the partner's offer, or making one.
      if (ctx.swap) return ctx.swap.seat === ctx.seat ? fail('swap-pending') : OK;
      if (ctx.abilityUse.workingTogether) return fail('ability-used');
      return ctx.partnerDiceLeft > 0 ? OK : fail('no-partner-dice');
    default:
      return fail('ability-unavailable');
  }
}

export const canUseAbility = (state: GameState, seat: Seat, action: AbilityAction): MoveCheck =>
  checkAbility(abilityContext(state, seat), action);

/**
 * - Adaptation: once per game, each player turns one of their dice to its opposite side.
 * - Anticipation: each round, before their first die, the first player may reroll one die.
 * - Working Together: once per round a player puts a die on the card; the partner MUST
 *   answer with one of theirs, and the two dice swap values.
 */
export function useAbility(state: GameState, seat: Seat, action: AbilityAction): GameState {
  const check = canUseAbility(state, seat, action);
  if (!check.ok) throw new RuleError(check.reason);
  const s = structuredClone(state);
  const die = s.dice[seat].find((d) => d.id === action.dieId)!;
  const logChange = (who: Seat, changed: Die) =>
    s.log.push({
      type: 'ability',
      round: s.round,
      seat: who,
      ability: action.ability,
      dieId: changed.id,
      value: changed.value,
    });

  switch (action.ability) {
    case 'adaptation':
      die.value = (7 - die.value) as DieValue;
      s.abilityUse.adaptation[seat] = true;
      logChange(seat, die);
      break;
    case 'anticipation': {
      const r = rollDie(s.rngState);
      s.rngState = r.rngState;
      die.value = r.value;
      s.abilityUse.anticipation = true;
      logChange(seat, die);
      break;
    }
    case 'working-together': {
      if (!s.swap) {
        s.swap = { seat, dieId: die.id, value: die.value };
        return s;
      }
      const offered = s.dice[s.swap.seat].find((d) => d.id === s.swap!.dieId)!;
      [offered.value, die.value] = [die.value, offered.value];
      s.abilityUse.workingTogether = true;
      logChange(s.swap.seat, offered);
      logChange(seat, die);
      s.swap = null;
      break;
    }
  }
  settleTurn(s);
  return s;
}
