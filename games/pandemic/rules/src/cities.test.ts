import { describe, expect, it } from 'vitest';
import { areLinked, CITIES, cityOf, COLORS, PACIFIC_LINKS, type CityId } from './cities';

describe('cities', () => {
  it('has 48 distinct cities', () => {
    expect(CITIES).toHaveLength(48);
    expect(new Set(CITIES.map((city) => city.id)).size).toBe(48);
  });

  it('has 12 cities of each color', () => {
    for (const color of COLORS) {
      expect(CITIES.filter((city) => city.color === color)).toHaveLength(12);
    }
  });

  it('links only to known cities, never to itself or twice to the same one', () => {
    for (const city of CITIES) {
      expect(new Set(city.links).size).toBe(city.links.length);
      expect(city.links).not.toContain(city.id);
      for (const other of city.links) expect(() => cityOf(other)).not.toThrow();
    }
  });

  it('has symmetric links', () => {
    for (const city of CITIES) {
      for (const other of city.links) {
        expect(areLinked(other, city.id), `${other} -> ${city.id}`).toBe(true);
      }
    }
  });

  it('includes the Pacific links both ways', () => {
    for (const [a, b] of PACIFIC_LINKS) {
      expect(areLinked(a, b)).toBe(true);
      expect(areLinked(b, a)).toBe(true);
    }
    expect(areLinked('sydney', 'manila')).toBe(true);
  });

  it('reaches every city from Atlanta', () => {
    const seen = new Set<CityId>(['atlanta']);
    const queue: CityId[] = ['atlanta'];
    for (let id = queue.shift(); id; id = queue.shift()) {
      for (const next of cityOf(id).links) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    expect(seen.size).toBe(48);
  });

  it('puts every city inside the map, apart from its neighbors', () => {
    for (const city of CITIES) {
      const [x, y] = city.at;
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(1);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(1);
    }
    const spots = new Set(CITIES.map((city) => city.at.join(',')));
    expect(spots.size).toBe(48);
  });
});
