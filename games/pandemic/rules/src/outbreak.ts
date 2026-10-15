// Placing disease cubes: infections, epidemics, outbreaks and their chain reactions.
import { cityOf, type CityId, type Color } from './cities';
import { rolesInPlay } from './roles';
import { MAX_OUTBREAKS, type GameState, type LossReason } from './types';

const CUBES_PER_CITY = 3;

export function lose(state: GameState, reason: LossReason): void {
  state.status = 'lost';
  state.lossReason = reason;
}

/** Whether a role in play stops cubes of `color` from being put on `city`. */
function prevented(state: GameState, city: CityId, color: Color): boolean {
  return rolesInPlay(state).some(({ seat, role }) => role.preventsCube?.(state, seat, city, color));
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
 * out). A city outbreaks once per call, so a loop of cities ends. A city a role protects gets
 * nothing and so never chains. Returns the cities that
 * outbroke, in order.
 */
function outbreak(state: GameState, start: CityId, color: Color): CityId[] {
  const queue: CityId[] = [start];
  const queued = new Set<CityId>(queue);
  const outbroken = new Set<CityId>();
  for (let city = queue.shift(); city !== undefined; city = queue.shift()) {
    outbroken.add(city);
    state.outbreaks += 1;
    if (state.outbreaks >= MAX_OUTBREAKS) {
      lose(state, 'outbreaks');
      return [...outbroken];
    }
    for (const next of cityOf(city).links) {
      if (outbroken.has(next) || queued.has(next) || prevented(state, next, color)) continue;
      if (state.cubes[next][color] >= CUBES_PER_CITY) {
        queued.add(next);
        queue.push(next);
      } else if (!placeCubes(state, next, color, 1)) {
        return [...outbroken];
      }
    }
  }
  return [...outbroken];
}

/** What infecting a city did (see `infectCity`). */
export interface Infection {
  color: Color;
  /** Cubes put on the city itself. */
  cubes: number;
  eradicated: boolean;
  /** A role stopped the cubes (Medic, Quarantine Specialist). */
  prevented: boolean;
  /** The cities that outbroke, in order: the city itself first, then its chain. */
  outbreaks: CityId[];
}

/**
 * Infects a city with `count` cubes of its color (1 for an infection card, 3 for an epidemic):
 * nothing if the disease is eradicated or a role protects the city; cubes up to 3, and an outbreak when there was not room.
 */
export function infectCity(state: GameState, city: CityId, count: number): Infection {
  const color = cityOf(city).color;
  if (state.cures[color] === 'eradicated') {
    return { color, cubes: 0, eradicated: true, prevented: false, outbreaks: [] };
  }
  if (prevented(state, city, color)) {
    return { color, cubes: 0, eradicated: false, prevented: true, outbreaks: [] };
  }
  const room = CUBES_PER_CITY - state.cubes[city][color];
  const cubes = Math.min(count, room);
  if (!placeCubes(state, city, color, cubes)) {
    return { color, cubes: 0, eradicated: false, prevented: false, outbreaks: [] };
  }
  const outbreaks = count > room ? outbreak(state, city, color) : [];
  return { color, cubes, eradicated: false, prevented: false, outbreaks };
}
