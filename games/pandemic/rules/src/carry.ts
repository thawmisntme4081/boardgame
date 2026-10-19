// Taking things along: a pawn whose role `carries` (the Relocation Specialist) may take up to 3
// cubes and 1 other pawn from the city it leaves, however it moves (its own moves, the
// Dispatcher's, Airlift). On its own moves its player chooses with the move; when another player
// moves it (an offer), its player chooses when accepting (`moveOffer.ts`). A pawn taken along is
// an offer its owner answers; declined, the whole move is called off.
import { checkEradicated, isMoveOffer, movePawn } from './actions';
import type { ActionCheck, ActionReason } from './actions';
import { COLORS, type CityId, type Color } from './cities';
import { putCubes } from './outbreak';
import { roleOf } from './roles';
import { pawnOwner, type ActionState, type GameState, type PawnId, type SeatId } from './types';

/** What a pawn takes along when it leaves a city. */
export interface Carry {
  /** Cubes from the city it leaves, one color per cube (`['blue', 'blue', 'red']`), at most 3. */
  cubes: Color[];
  /** Another pawn in that city; its owner agrees first. */
  pawn?: PawnId;
}

export const MAX_CARRIED_CUBES = 3;

const OK: ActionCheck = { ok: true };
const fail = (reason: ActionReason): ActionCheck => ({ ok: false, reason });

/** Whether `pawn` takes things along when it moves: a seat's own pawn whose role carries. */
export const carriesAlong = (state: Pick<ActionState, 'roles'>, pawn: PawnId): boolean =>
  pawn === pawnOwner(pawn) && roleOf(state, pawnOwner(pawn))?.carries === true;

/** How many of the cubes are of `color`. */
export const carriedOf = (cubes: readonly Color[], color: Color): number =>
  cubes.filter((cube) => cube === color).length;

/** Whether `pawn` may take `carry` along from the city it stands in (who chooses is checked apart). */
export function checkCarry(state: ActionState, pawn: PawnId, carry: Carry): ActionCheck {
  if (!carriesAlong(state, pawn)) return fail('wrong-role');
  const from = state.pawns[pawn] as CityId;
  if (carry.cubes.length > MAX_CARRIED_CUBES) return fail('too-many-cubes');
  if (COLORS.some((color) => carriedOf(carry.cubes, color) > state.cubes[from][color])) {
    return fail('no-cubes');
  }
  if (carry.pawn === undefined) return OK;
  return carry.pawn !== pawn && state.pawns[carry.pawn] === from ? OK : fail('not-together');
}

/**
 * The pawn whose owner must agree before `seat` moves `pawn` with `carry`: the moved pawn when
 * it is another player's, else a pawn taken along that is; `null` when nobody is asked.
 */
export function answeringPawn(seat: SeatId, pawn: PawnId, carry: Carry | undefined): PawnId | null {
  if (isMoveOffer(seat, pawn)) return pawn;
  return carry?.pawn !== undefined && isMoveOffer(seat, carry.pawn) ? carry.pawn : null;
}

/**
 * Moves `pawn` to `to` with what it takes along (it was checked). The pawns arrive first (a
 * carried Medic already protects the city), then the cubes leave the city, color by color: none
 * stay where a role protects the city, up to 3 of a color do, and the city outbreaks when there
 * was not room; the cubes that do not stay go back to the supply. The log says where they went.
 */
export function moveWith(state: GameState, pawn: PawnId, to: CityId, carry?: Carry): void {
  const from = state.pawns[pawn] as CityId;
  movePawn(state, pawn, to);
  if (!carry) return;
  if (carry.pawn !== undefined) movePawn(state, carry.pawn, to);
  for (const color of COLORS) {
    const count = carriedOf(carry.cubes, color);
    if (count === 0 || state.status !== 'playing') continue;
    // Off the city they leave, through the supply, onto the city they reach.
    state.cubes[from][color] -= count;
    state.supply[color] += count;
    const { cubes, prevented, outbreaks } = putCubes(state, to, color, count);
    state.log.current.entries.push({
      type: 'carried',
      city: to,
      color,
      cubes,
      prevented,
      outbreaks,
    });
    checkEradicated(state, color);
  }
}
