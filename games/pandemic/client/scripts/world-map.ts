// Draws the world map's land once, from Natural Earth's 1:110m land (the `world-atlas` package,
// public domain), into `src/lib/worldLand.ts`: one SVG path in the map's 950 × 690 frame.
// Usage: pnpm --filter @pandemic/client world-map
//
// The board is stylized (Europe is spread out, the Pacific cut in two), so the land is fitted
// under the cities' old places (`FIT_PLACES`): a projection (scale and offset on each axis, least
// squares over the 48 cities) is chosen among a few, then the land is bent a little toward them.
// The run then prints where each city should stand to be on the land, apart from the others
// (`onLand`): those are the values of `CITY_POINTS` in `lib/mapGeometry.ts`.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CITIES, type CityId } from '@pandemic/rules';
import { geoPath, geoProjection, type GeoRawProjection } from 'd3-geo';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import land from 'world-atlas/land-110m.json' with { type: 'json' };
import { MAP_HEIGHT, MAP_WIDTH } from '../src/lib/mapGeometry';

/** Each city's longitude and latitude, in degrees. */
const PLACES: Record<CityId, readonly [lon: number, lat: number]> = {
  'san-francisco': [-122.42, 37.77],
  chicago: [-87.63, 41.88],
  montreal: [-73.57, 45.5],
  'new-york': [-74.01, 40.71],
  atlanta: [-84.39, 33.75],
  washington: [-77.04, 38.91],
  london: [-0.13, 51.51],
  madrid: [-3.7, 40.42],
  essen: [7.01, 51.46],
  paris: [2.35, 48.86],
  milan: [9.19, 45.46],
  'st-petersburg': [30.34, 59.93],
  'los-angeles': [-118.24, 34.05],
  'mexico-city': [-99.13, 19.43],
  miami: [-80.19, 25.76],
  bogota: [-74.07, 4.71],
  lima: [-77.04, -12.05],
  santiago: [-70.67, -33.45],
  'buenos-aires': [-58.38, -34.6],
  'sao-paulo': [-46.63, -23.55],
  lagos: [3.38, 6.52],
  khartoum: [32.56, 15.5],
  kinshasa: [15.27, -4.44],
  johannesburg: [28.05, -26.2],
  moscow: [37.62, 55.76],
  tehran: [51.39, 35.69],
  istanbul: [28.98, 41.01],
  baghdad: [44.36, 33.31],
  algiers: [3.06, 36.75],
  cairo: [31.24, 30.04],
  riyadh: [46.68, 24.71],
  karachi: [67.01, 24.86],
  delhi: [77.21, 28.61],
  kolkata: [88.36, 22.57],
  mumbai: [72.88, 19.08],
  chennai: [80.27, 13.08],
  beijing: [116.41, 39.9],
  seoul: [126.98, 37.57],
  tokyo: [139.69, 35.68],
  shanghai: [121.47, 31.23],
  osaka: [135.5, 34.69],
  taipei: [121.57, 25.03],
  'hong-kong': [114.17, 22.32],
  bangkok: [100.5, 13.76],
  'ho-chi-minh-city': [106.63, 10.82],
  manila: [120.98, 14.6],
  jakarta: [106.85, -6.21],
  sydney: [151.21, -33.87],
};

/**
 * Where the cities stood on the board when the land was fitted. The land is bent toward these
 * places; the cities have since been moved onto the land (`lib/mapGeometry.ts`), so the fit keeps
 * its own copy and a new run draws the same land.
 */
const FIT_PLACES: Record<CityId, readonly [x: number, y: number]> = {
  'san-francisco': [59, 237.5],
  chicago: [147, 212.5],
  montreal: [216, 210],
  'new-york': [269, 218],
  atlanta: [171, 264],
  washington: [245.5, 259],
  london: [396.5, 176.5],
  madrid: [387, 244.5],
  essen: [465.5, 164.5],
  paris: [448.5, 210.5],
  milan: [494, 197],
  'st-petersburg': [541.5, 150.5],
  'los-angeles': [72, 306.5],
  'mexico-city': [136.5, 329.5],
  miami: [215.5, 319],
  bogota: [209.5, 389],
  lima: [185, 463.5],
  santiago: [194, 539.5],
  'buenos-aires': [267, 526.5],
  'sao-paulo': [307, 474],
  lagos: [441, 376.5],
  khartoum: [529, 364],
  kinshasa: [484.5, 425],
  johannesburg: [524, 494.5],
  moscow: [579, 197],
  tehran: [626, 229.5],
  istanbul: [524.5, 237],
  baghdad: [574, 273],
  algiers: [463, 282.5],
  cairo: [515, 296.5],
  riyadh: [582, 335.5],
  karachi: [640, 295.5],
  delhi: [690.5, 276],
  kolkata: [738.5, 293],
  mumbai: [646.5, 346.5],
  chennai: [700, 384],
  beijing: [778, 214],
  seoul: [839.5, 210.5],
  tokyo: [888, 237.75],
  shanghai: [782.5, 262],
  osaka: [893.5, 290],
  taipei: [843.5, 310.5],
  'hong-kong': [788.5, 320.5],
  bangkok: [748.5, 351],
  'ho-chi-minh-city': [791, 400],
  manila: [858.5, 396],
  jakarta: [748.5, 443.5],
  sydney: [898.5, 537.5],
};

const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** Candidate projections: the latitude's spacing differs (equal steps, or growing toward the poles). */
const PROJECTIONS: Record<string, GeoRawProjection> = {
  equirectangular: (lambda, phi) => [lambda, phi],
  miller: (lambda, phi) => [lambda, 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * phi))],
  mercator: (lambda, phi) => [lambda, Math.log(Math.tan(Math.PI / 4 + phi / 2))],
};

/** The best `value = scale * input + offset` over the pairs (ordinary least squares). */
function fitLine(pairs: [input: number, value: number][]): { scale: number; offset: number } {
  const n = pairs.length;
  const mean = (pick: (p: [number, number]) => number) =>
    pairs.reduce((sum, p) => sum + pick(p), 0) / n;
  const mx = mean((p) => p[0]);
  const my = mean((p) => p[1]);
  const sxy = pairs.reduce((sum, [x, y]) => sum + (x - mx) * (y - my), 0);
  const sxx = pairs.reduce((sum, [x]) => sum + (x - mx) ** 2, 0);
  const scale = sxy / sxx;
  return { scale, offset: my - scale * mx };
}

function fit(raw: GeoRawProjection) {
  const ids = CITIES.map(({ id }) => id);
  const projected = ids.map((id) => {
    const [lon, lat] = PLACES[id];
    return raw(radians(lon), radians(lat)) as [number, number];
  });
  const fx = fitLine(ids.map((id, i) => [projected[i]![0], FIT_PLACES[id][0]]));
  // The map's y grows downward; the fit finds the negative scale itself.
  const fy = fitLine(ids.map((id, i) => [projected[i]![1], FIT_PLACES[id][1]]));
  const toMap = ([x, y]: readonly [number, number]): [number, number] => [
    fx.scale * x + fx.offset,
    fy.scale * y + fy.offset,
  ];
  const errors = ids
    .map((id, i) => {
      const [x, y] = toMap(projected[i]!);
      const at = FIT_PLACES[id];
      return { id, distance: Math.hypot(x - at[0], y - at[1]) };
    })
    .sort((a, b) => b.distance - a.distance);
  const rms = Math.sqrt(errors.reduce((sum, e) => sum + e.distance ** 2, 0) / errors.length);
  return { fx, fy, toMap, errors, rms };
}

const fits = Object.entries(PROJECTIONS).map(([name, raw]) => ({ name, raw, ...fit(raw) }));
for (const { name, rms } of fits) console.log(`${name.padEnd(16)} rms ${rms.toFixed(1)} px`);
const best = fits.reduce((a, b) => (b.rms < a.rms ? b : a));
console.log(`\nUsing ${best.name}. Farthest cities from their real places (map pixels):`);
for (const { id, distance } of best.errors.slice(0, 10)) {
  console.log(`  ${id.padEnd(18)} ${distance.toFixed(1)}`);
}

// d3 does the clipping (the antimeridian, the map's frame) on the raw projection at scale 1;
// the fitted scale and offset of each axis are applied when the path is written out.
const { fx, fy } = best;
const inverse = (x: number, y: number): [number, number] => [
  (x - fx.offset) / fx.scale,
  // d3 flips y (its raw y grows upward): undo the flip that `toMap` applies through `fy`.
  -(y - fy.offset) / fy.scale,
];
const [left, top] = inverse(0, 0);
const [right, bottom] = inverse(MAP_WIDTH, MAP_HEIGHT);
const projection = geoProjection(best.raw)
  .scale(1)
  .translate([0, 0])
  .precision(0.002)
  .clipExtent([
    [Math.min(left, right), Math.min(top, bottom)],
    [Math.max(left, right), Math.max(top, bottom)],
  ]);

type Point = [x: number, y: number];

/** Solves `a · x = b` for each right-hand side (Gaussian elimination, partial pivoting). */
function solve(a: number[][], rhs: number[][]): number[][] {
  const n = a.length;
  const m = a.map((row, i) => [...row, ...rhs.map((b) => b[i]!)]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r]![col]!) > Math.abs(m[pivot]![col]!)) pivot = r;
    }
    [m[col], m[pivot]] = [m[pivot]!, m[col]!];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const k = m[r]![col]! / m[col]![col]!;
      for (let c = col; c < m[r]!.length; c++) m[r]![c]! -= k * m[col]![c]!;
    }
  }
  return rhs.map((_, j) => m.map((row, i) => row[n + j]! / m[i]![i]!));
}

/**
 * A thin-plate spline taking each `from` point to its `to` point and bending the plane smoothly
 * in between (the "rubber sheet" under the board's stylized city places).
 */
function thinPlate(from: Point[], to: Point[], smoothing: number): (p: Point) => Point {
  const n = from.length;
  // U(r) = r² log r, written with r² so no square root is taken.
  const u = (r2: number) => (r2 === 0 ? 0 : (r2 * Math.log(r2)) / 2);
  const d2 = (a: Point, b: Point) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
  const a = Array.from({ length: n + 3 }, () => Array<number>(n + 3).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) a[i]![j] = u(d2(from[i]!, from[j]!)) + (i === j ? smoothing : 0);
    const [x, y] = from[i]!;
    a[i]![n] = 1;
    a[i]![n + 1] = x;
    a[i]![n + 2] = y;
    a[n]![i] = 1;
    a[n + 1]![i] = x;
    a[n + 2]![i] = y;
  }
  const [wx, wy] = solve(a, [
    [...to.map((p) => p[0]), 0, 0, 0],
    [...to.map((p) => p[1]), 0, 0, 0],
  ]) as [number[], number[]];
  return (p) => {
    const at = (w: number[]) =>
      w[n]! +
      w[n + 1]! * p[0] +
      w[n + 2]! * p[1] +
      from.reduce((s, c, i) => s + w[i]! * u(d2(p, c)), 0);
    return [at(wx), at(wy)];
  };
}

// Each city's real place (after the fit) goes to its place on the board. Points around the frame,
// a little outside it, stay where the fit put them, so the bending stays local to the cities.
const anchors: Point[] = [];
for (let x = -40; x <= MAP_WIDTH + 40; x += 110) anchors.push([x, -40], [x, MAP_HEIGHT + 40]);
for (let y = 60; y < MAP_HEIGHT; y += 110) anchors.push([-40, y], [MAP_WIDTH + 40, y]);
const fitted: Point[] = CITIES.map(({ id }) => {
  const [lon, lat] = PLACES[id];
  return best.toMap(best.raw(radians(lon), radians(lat)) as Point);
});
const boardPlaces: Point[] = CITIES.map(({ id }): Point => [FIT_PLACES[id][0], FIT_PLACES[id][1]]);

const topology = land as unknown as Topology<{ land: GeometryCollection }>;
const shapes = feature(topology, topology.objects.land);

/** The land bent with this much smoothing: its path and its rings (in map pixels). */
function buildLand(smoothing: number) {
  const warp = thinPlate([...fitted, ...anchors], [...boardPlaces, ...anchors], smoothing);
  const rings: Point[][] = [];
  let d = '';
  let last = '';
  const point = (x: number, y: number): Point =>
    warp([fx.scale * x + fx.offset, fy.scale * -y + fy.offset]);
  const text = ([x, y]: Point) =>
    `${x.toFixed(1).replace(/\.0$/, '')} ${y.toFixed(1).replace(/\.0$/, '')}`;
  const writer = {
    moveTo(x: number, y: number) {
      const p = point(x, y);
      rings.push([p]);
      last = text(p);
      d += `M${last}`;
    },
    lineTo(x: number, y: number) {
      const p = point(x, y);
      const next = text(p);
      if (next !== last) {
        d += `L${next}`;
        rings[rings.length - 1]!.push(p);
      }
      last = next;
    },
    closePath() {
      d += 'Z';
    },
    beginPath() {
      // Each ring starts with moveTo.
    },
    arc() {
      // Points only (geoPath's pointRadius is not used for polygons).
    },
  };
  geoPath(projection, writer)(shapes);
  return { d, rings };
}

/** Whether `p` is inside a ring (ray casting). */
function inside(p: Point, ring: Point[]): boolean {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) yes = !yes;
  }
  return yes;
}

/** The distance from `p` to the nearest edge of the rings. */
function edgeDistance(p: Point, rings: Point[][]): number {
  let best = Infinity;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, ay] = ring[j]!;
      const [bx, by] = ring[i]!;
      const len2 = (bx - ax) ** 2 + (by - ay) ** 2;
      const t =
        len2 === 0
          ? 0
          : Math.max(0, Math.min(1, ((p[0] - ax) * (bx - ax) + (p[1] - ay) * (by - ay)) / len2));
      best = Math.min(best, Math.hypot(p[0] - (ax + t * (bx - ax)), p[1] - (ay + t * (by - ay))));
    }
  }
  return best;
}

/** The cities that are neither on land nor within `margin` pixels of it. */
function citiesAtSea(rings: Point[][], margin: number): string[] {
  return CITIES.filter(({ id }) => {
    const p: Point = [FIT_PLACES[id][0], FIT_PLACES[id][1]];
    return !rings.some((ring) => inside(p, ring)) && edgeDistance(p, rings) > margin;
  }).map(({ id }) => id);
}

// How much the land may refuse to bend: 0 puts every city exactly on its place (and stretches the
// continents to do it); a larger number keeps the coastlines natural and lets the cities sit a
// little off. The script takes the largest one that leaves every city on land or within `MARGIN`
// pixels of it (28: a dot beside the coast); exact placement bent the continents too much (a
// crushed Europe, a stretched Iberia). `SMOOTHING=...` or `MARGIN=...` try other values.
const MARGIN = Number(process.env.MARGIN ?? 28);
function chooseSmoothing(): number {
  // The user's pick (a natural land): the cities are moved onto it afterwards, not the land onto them.
  if (!process.env.SEARCH) return Number(process.env.SMOOTHING ?? 12000);
  let low = 0;
  let high = 4_000_000;
  for (let step = 0; step < 14; step++) {
    const mid = (low + high) / 2;
    if (citiesAtSea(buildLand(mid).rings, MARGIN).length === 0) low = mid;
    else high = mid;
  }
  return low;
}
const SMOOTHING = chooseSmoothing();
const { d, rings } = buildLand(SMOOTHING);
console.log(
  `\nSmoothing ${Math.round(SMOOTHING)}; cities at sea (more than ${MARGIN} px from land): ${citiesAtSea(rings, 0).length} on the coast or in the sea, ${citiesAtSea(rings, MARGIN).length} beyond the margin`,
);

/**
 * Moves the cities onto the land with room around them (a dot's radius), keeping each near the
 * place it had and apart from the others (so labels stay readable). A relaxation: each round
 * pulls a city a little back toward its old place, pushes crowded pairs apart, and puts any city
 * that ended up in the sea back on the nearest dry spot (found on a coarse grid).
 */
const CLEARANCE = 2;
// Labels are wide and short, so the spacing is an oval: 1.6 times more room across than down.
const SEPARATION = 25;
const WIDER = 1.6;
const CELL = 3;
function onLand(): Record<string, [number, number]> {
  const cols = Math.ceil(MAP_WIDTH / CELL);
  const rows = Math.ceil(MAP_HEIGHT / CELL);
  const dry: Point[] = [];
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const p: Point = [gx * CELL + CELL / 2, gy * CELL + CELL / 2];
      if (rings.some((ring) => inside(p, ring)) && edgeDistance(p, rings) >= CLEARANCE) dry.push(p);
    }
  }
  const nearestDry = (p: Point): Point => {
    let best = dry[0]!;
    let bestD = Infinity;
    for (const q of dry) {
      const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2;
      if (d < bestD) {
        bestD = d;
        best = q;
      }
    }
    return best;
  };
  const isDry = (p: Point) =>
    rings.some((ring) => inside(p, ring)) && edgeDistance(p, rings) >= CLEARANCE;

  const ids = CITIES.map(({ id }) => id);
  const home = ids.map((id): Point => [FIT_PLACES[id][0], FIT_PLACES[id][1]]);
  const at = home.map((p): Point => (isDry(p) ? [...p] : [...nearestDry(p)]));
  for (let round = 0; round < 400; round++) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const dx = (at[j]![0] - at[i]![0]) / WIDER;
        const dy = at[j]![1] - at[i]![1];
        const dist = Math.hypot(dx, dy) || 0.01;
        if (dist < SEPARATION) {
          const push = ((SEPARATION - dist) / 2) * 0.5;
          at[i]![0] -= (dx / dist) * push * WIDER;
          at[i]![1] -= (dy / dist) * push;
          at[j]![0] += (dx / dist) * push * WIDER;
          at[j]![1] += (dy / dist) * push;
        }
      }
    }
    for (let i = 0; i < ids.length; i++) {
      at[i]![0] += (home[i]![0] - at[i]![0]) * 0.01;
      at[i]![1] += (home[i]![1] - at[i]![1]) * 0.01;
      if (!isDry(at[i]!)) at[i] = [...nearestDry(at[i]!)];
    }
  }
  const moves: Record<string, [number, number]> = {};
  ids.forEach((id, i) => {
    const q: Point = [Math.round(at[i]![0] * 2) / 2, Math.round(at[i]![1] * 2) / 2];
    moves[id] = isDry(q) ? q : (nearestDry(q).map((v) => Math.round(v * 2) / 2) as Point);
  });
  const tooClose = ids.flatMap((a, i) =>
    ids
      .slice(i + 1)
      .filter(
        (b) =>
          Math.hypot((moves[a]![0] - moves[b]![0]) / WIDER, moves[a]![1] - moves[b]![1]) <
          SEPARATION - 3,
      ),
  );
  console.log(`\nPairs still closer than ${SEPARATION - 3}: ${tooClose.length}`);
  return moves;
}
console.log('\nCities to move onto the land (x, y):');
console.log(JSON.stringify(onLand(), null, 1));

const out = fileURLToPath(new URL('../src/lib/worldLand.ts', import.meta.url));
writeFileSync(
  out,
  `// Generated by \`pnpm --filter @pandemic/client world-map\` (scripts/world-map.ts) from Natural
// Earth's 1:110m land (the \`world-atlas\` package, public domain), fitted under the cities'
// places with the ${best.name} projection, then bent a little (a smoothed thin-plate spline, smoothing ${Math.round(SMOOTHING)})
// toward each city's place on the board. Do not edit by hand: run the script again.

/** The land of the world map, as one SVG path in the map's ${MAP_WIDTH} × ${MAP_HEIGHT} frame. */
export const WORLD_LAND =
  '${d}';
`,
);
console.log(`\nWrote ${out} (${(d.length / 1024).toFixed(1)} KB of path).`);
