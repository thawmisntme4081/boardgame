// Placing disease cubes: infections, epidemics, outbreaks and their chain reactions.
import { cityOf, type CityId, type Color } from './cities';
import { MAX_OUTBREAKS, type GameState, type LossReason } from './types';

const CUBES_PER_CITY = 3;

export function lose(state: GameState, reason: LossReason): void {
  state.status = 'lost';
  state.lossReason = reason;
}

/** Puts cubes on a city and takes them from the supply; the game is lost if there are too few. */
function placeCubes(state: GameState, city: CityId, color: Color, count: number): boolean {
  if (state.supply[color] < count) {
    lose(state, 'cubes');
    return false;
  }
  state.cubes[city][color] += count;
  state.supply[color] -= count;
  return true;
}

/**
 * An outbreak of `color` in `start`: the marker moves, every connected city gets a cube, and a
 * city that would get a fourth has a chain reaction after this outbreak is done (first in, first
 * out). A city outbreaks once per call, so a loop of cities ends.
 */
function outbreak(state: GameState, start: CityId, color: Color): void {
  const queue: CityId[] = [start];
  const queued = new Set<CityId>(queue);
  const outbroken = new Set<CityId>();
  for (let city = queue.shift(); city !== undefined; city = queue.shift()) {
    outbroken.add(city);
    state.outbreaks += 1;
    if (state.outbreaks >= MAX_OUTBREAKS) {
      lose(state, 'outbreaks');
      return;
    }
    for (const next of cityOf(city).links) {
      if (outbroken.has(next) || queued.has(next)) continue;
      if (state.cubes[next][color] >= CUBES_PER_CITY) {
        queued.add(next);
        queue.push(next);
      } else if (!placeCubes(state, next, color, 1)) {
        return;
      }
    }
  }
}

/**
 * Infects a city with `count` cubes of its color (1 for an infection card, 3 for an epidemic):
 * nothing if the disease is eradicated; cubes up to 3, and an outbreak when there was not room.
 */
export function infectCity(state: GameState, city: CityId, count: number): void {
  const color = cityOf(city).color;
  if (state.cures[color] === 'eradicated') return;
  const room = CUBES_PER_CITY - state.cubes[city][color];
  if (!placeCubes(state, city, color, Math.min(count, room))) return;
  if (count > room) outbreak(state, city, color);
}
