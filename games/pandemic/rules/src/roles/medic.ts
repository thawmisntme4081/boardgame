import { checkEradicated } from '../actions';
import { COLORS, type Color } from '../cities';
import type { GameState, SeatId } from '../types';
import type { RoleModule } from './types';

/** Takes every cube of `color` off the Medic's city, back to the supply. */
function clear(state: GameState, holder: SeatId, color: Color): void {
  const city = state.pawns[holder];
  if (city === undefined) return;
  const cubes = state.cubes[city];
  state.supply[color] += cubes[color];
  cubes[color] = 0;
  checkEradicated(state, color);
}

/**
 * Treats every cube of a color at once. Cured diseases never stay where the Medic is: their
 * cubes go when the Medic arrives (however they got there) or the cure is found, and none can be
 * put there (an outbreak into the Medic's city places nothing and does not chain).
 */
export const medic: RoleModule = {
  id: 'medic',
  treatsAll: true,
  onEnterCity(state, holder) {
    for (const color of COLORS) if (state.cures[color] !== 'none') clear(state, holder, color);
  },
  onCure(state, holder, color) {
    clear(state, holder, color);
  },
  preventsCube(state, holder, city, color) {
    return state.pawns[holder] === city && state.cures[color] !== 'none';
  },
};
