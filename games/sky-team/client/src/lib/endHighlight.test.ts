import type { DieValue, EndReason, PlacedDie } from '@sky/rules';
import { describe, expect, it } from 'vitest';
import { catalogScenario, makeView } from '../test/fixtures';
import { endHighlight } from './endHighlight';

const lost = (reason: EndReason, patch: Parameters<typeof makeView>[1] = {}) =>
  makeView('pilot', {
    ...patch,
    patch: { phase: 'lost', endReason: reason, ...patch.patch },
  });
const die = (seat: 'pilot' | 'copilot', value: DieValue): PlacedDie => ({
  seat,
  dieId: `d-${seat}`,
  value,
});

describe('what a lost game points at', () => {
  it('a spin: both Axis dice, and the red zone the needle went into', () => {
    expect(endHighlight(lost('spin', { patch: { axis: -3 } }))).toEqual({
      slots: ['axisPilot', 'axisCopilot'],
      axisZone: -3,
    });
    expect(endHighlight(lost('spin', { patch: { axis: 4 } }))).toMatchObject({ axisZone: 3 });
  });

  it('a collision or an overshoot: the Engine dice, the speed and the space reached', () => {
    for (const reason of ['collision', 'overshoot'] as const) {
      expect(endHighlight(lost(reason, { patch: { approachIndex: 2 } }))).toEqual({
        slots: ['enginePilot', 'engineCopilot'],
        speed: true,
        approach: [2],
      });
    }
  });

  it('a wrong axis at a turn: Engine dice, speed, the space and the needle', () => {
    expect(endHighlight(lost('turn', { patch: { approachIndex: 3, axis: 2 } }))).toEqual({
      slots: ['enginePilot', 'engineCopilot'],
      speed: true,
      approach: [3],
      axisZone: 2,
    });
  });

  it('a missed airport: where the plane is and where the airport is', () => {
    const view = lost('missed-airport', {
      patch: { approachIndex: 3, approachPlanes: [0, 0, 0, 0, 0] },
    });
    expect(endHighlight(view)).toEqual({ slots: [], approach: [3, 4] });
  });

  it('missing mandatory dice: the empty Axis and Engine spaces', () => {
    const view = lost('mandatory-missing', {
      patch: { placed: { axisPilot: die('pilot', 3), enginePilot: die('pilot', 4) } },
    });
    expect(endHighlight(view)?.slots).toEqual(['axisCopilot', 'engineCopilot']);
  });

  it('failed landings: every failed condition is marked, on what was left undone', () => {
    const view = lost('landing-gear', {
      patch: {
        landingFailures: ['landing-gear', 'landing-flaps', 'landing-traffic'],
        placed: { gear1: die('pilot', 1), flaps1: die('copilot', 1) },
        approachPlanes: [0, 1, 0, 2],
      },
    });
    const mark = endHighlight(view)!;
    expect(mark.slots).toEqual(['gear2', 'gear3', 'flaps2', 'flaps3', 'flaps4']);
    expect(mark.approach).toEqual([1, 3]);
  });

  it('an unlevel plane, and a speed too high for the brakes', () => {
    expect(endHighlight(lost('landing-axis', { patch: { axis: -1 } }))).toEqual({
      slots: ['axisPilot', 'axisCopilot'],
      axisZone: -1,
    });
    const brakes = lost('landing-brakes', { patch: { placed: { brakes1: die('pilot', 2) } } });
    expect(endHighlight(brakes)).toEqual({
      slots: ['enginePilot', 'engineCopilot', 'brakes2', 'brakes3'],
      speed: true,
    });
  });

  it('ice brakes and the intern: the spaces of those modules', () => {
    const ice = catalogScenario((s) => s.modules.includes('ice-brakes'));
    const iceMark = endHighlight(lost('landing-ice-brakes', { scenario: ice.id }))!;
    expect(iceMark.slots.length).toBeGreaterThan(0);
    const intern = catalogScenario((s) => s.modules.includes('intern'));
    expect(endHighlight(lost('landing-intern', { scenario: intern.id }))?.slots).toEqual([
      'internPilot',
      'internCopilot',
    ]);
  });

  it('kerosene: the gauge', () => {
    expect(endHighlight(lost('kerosene'))).toEqual({ slots: [], gauge: 'kerosene' });
  });

  it('nothing for a game still on, or for running out of time', () => {
    expect(endHighlight(makeView('pilot'))).toBeNull();
    expect(endHighlight(lost('time-up'))).toBeNull();
  });
});
