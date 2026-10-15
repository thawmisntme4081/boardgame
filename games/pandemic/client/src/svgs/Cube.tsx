import type { Color } from '@pandemic/rules';
import { useEffect, useRef, type SVGProps } from 'react';
import { onFrame } from '../lib/frames';

const HALF = 6;
const ORBIT_SPEED = 0.5;

const TAU = Math.PI * 2;

type Vec = [number, number, number];

/** The six faces of a cube: the outward normal and the four corners (of a cube of half edge 1). */
const FACES: { normal: Vec; corners: Vec[] }[] = [0, 1, 2].flatMap((k) =>
  [1, -1].map((sign) => {
    const normal: Vec = [0, 0, 0];
    normal[k] = sign;
    const u: Vec = [0, 0, 0];
    u[(k + 1) % 3] = 1;
    const v: Vec = [0, 0, 0];
    v[(k + 2) % 3] = 1;
    const corner = (a: number, b: number) =>
      normal.map((c, i) => c + a * (u[i] ?? 0) + b * (v[i] ?? 0)) as Vec;
    return { normal, corners: [corner(1, 1), corner(-1, 1), corner(-1, -1), corner(1, -1)] };
  }),
);

/** Turns `p` around the x, then y, then z axis. */
function rotate([x, y, z]: Vec, ax: number, ay: number, az: number): Vec {
  const y1 = y * Math.cos(ax) - z * Math.sin(ax);
  const z1 = y * Math.sin(ax) + z * Math.cos(ax);
  const x2 = x * Math.cos(ay) + z1 * Math.sin(ay);
  const z2 = -x * Math.sin(ay) + z1 * Math.cos(ay);
  return [x2 * Math.cos(az) - y1 * Math.sin(az), x2 * Math.sin(az) + y1 * Math.cos(az), z2];
}

/** The direction the light comes from (up, left, toward the viewer). */
const LIGHT: Vec = [-0.35, -0.55, 0.76];

/** A face's color: the disease color, lighter or darker by how much the face meets the light. */
function shade(color: Color, lit: number): string {
  const base = `var(--color-disease-${color})`;
  const t = lit - 0.45;
  return t > 0
    ? `color-mix(in oklch, ${base}, white ${Math.round(t * 55)}%)`
    : `color-mix(in oklch, ${base}, black ${Math.round(-t * 45)}%)`;
}

/** How finely the light is graded: a face's fill changes only when it crosses a step. */
const SHADES = 48;
const shades = new Map<Color, string[]>();

/** The shades of one color, built once: index 0 faces away from the light, `SHADES` faces it. */
function shadesOf(color: Color): string[] {
  let list = shades.get(color);
  if (!list) {
    list = Array.from({ length: SHADES + 1 }, (_, i) => shade(color, (i / SHADES) * 2 - 1));
    shades.set(color, list);
  }
  return list;
}

const stillMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export interface CubeProps extends Omit<SVGProps<SVGGElement>, 'color'> {
  color: Color;
  seed: number;
  radius: number;
  angle: number;
  /** Shrinks the cube away; the page removes it afterward. */
  leaving?: boolean;
}

/**
 * A disease cube: a real 3D cube, redrawn on every frame, that tumbles on its own axes while it
 * goes around the city at the origin of the group it is drawn in. Draw it inside an <svg>.
 */
export function Cube({ color, seed, radius, angle, leaving = false, ...props }: CubeProps) {
  const group = useRef<SVGGElement>(null);
  // Where the cube is heading; read on every frame, so a change eases in without starting over.
  const goal = useRef({ radius, angle, leaving });
  useEffect(() => {
    goal.current = { radius, angle, leaving };
  });

  useEffect(() => {
    const g = group.current;
    if (!g) return;
    const faces = Array.from(g.children) as SVGPathElement[];
    const fills = shadesOf(color);
    // What each face shows now: a frame only writes what changed.
    const shownPath = faces.map(() => '');
    const shownShade = faces.map(() => -1);
    let shownAt = '';
    // Reduced motion: the cube stands still (no tumbling, no orbit) and only moves when it must.
    const still = stillMotion();
    // A different, steady spin for each cube.
    const wx = 0.1 + ((seed * 0.3) % 0.5);
    const wy = 0.1 + ((seed * 0.3) % 0.5);
    const wz = 0.1 + ((seed * 0.3) % 0.5);
    let r = goal.current.radius;
    let offset = goal.current.angle;
    // The cube pops in: its size springs from nothing to full, with a little overshoot.
    let size = 0;
    let speed = 0;
    let last = 0;
    return onFrame((time) => {
      const t = still ? 0 : time;
      const now = goal.current;
      const dt = Math.min(0.05, Math.max(0, time - last));
      last = time;
      const ease = 1 - Math.exp(-dt * 6);
      r += (now.radius - r) * ease;
      const turn = ((((now.angle - offset + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
      offset += turn * ease;
      speed += ((now.leaving ? 0 : 1) - size) * 180 * dt;
      speed *= Math.exp(-dt * 9);
      size = Math.max(0, size + speed * dt);
      const ax = seed * 1.7 + wx * t;
      const ay = seed * 2.3 + wy * t;
      const az = seed * 0.9 + wz * t;
      const theta = offset + ORBIT_SPEED * t;
      const at = `translate(${(r * Math.cos(theta)).toFixed(2)} ${(r * Math.sin(theta)).toFixed(2)})`;
      if (at !== shownAt) g.setAttribute('transform', (shownAt = at));
      const half = HALF * size;
      FACES.forEach(({ normal, corners }, i) => {
        const face = faces[i];
        if (!face) return;
        const [nx, ny, nz] = rotate(normal, ax, ay, az);
        let path = '';
        if (nz > 0 && half >= 0.05) {
          const points = corners.map((corner) => {
            const [x, y] = rotate(corner, ax, ay, az);
            return `${(x * half).toFixed(2)} ${(y * half).toFixed(2)}`;
          });
          path = `M${points.join('L')}Z`;
          const lit = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
          const step = Math.min(SHADES, Math.max(0, Math.round(((lit + 1) / 2) * SHADES)));
          if (step !== shownShade[i]) {
            shownShade[i] = step;
            face.style.fill = fills[step] ?? '';
          }
        }
        if (path !== shownPath[i]) face.setAttribute('d', (shownPath[i] = path));
      });
    });
  }, [color, seed]);

  return (
    <g ref={group} {...props}>
      {FACES.map(({ normal }) => (
        <path key={normal.join()} />
      ))}
    </g>
  );
}
