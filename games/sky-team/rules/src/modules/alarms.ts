import { nextRandom } from '../rng';
import { SLOTS } from '../slots';
import type { AlarmId, SlotId } from '../types';
import type { RuleModule } from './types';

/** The six Alarm tokens, in Alarm board order. */
export const ALARM_IDS: readonly AlarmId[] = [
  'concentration',
  'brakes',
  'gear',
  'flaps',
  'radioPilot',
  'radioCopilot',
];

/** Each token's space on the Alarm board, and the Action spaces it blocks while face up. */
export const ALARMS: Record<AlarmId, { slot: SlotId; blocks: readonly SlotId[] }> = {
  concentration: {
    slot: 'alarmConcentration',
    blocks: ['concentration1', 'concentration2', 'concentration3'],
  },
  brakes: { slot: 'alarmBrakes', blocks: ['brakes1', 'brakes2', 'brakes3'] },
  gear: { slot: 'alarmGear', blocks: ['gear1', 'gear2', 'gear3'] },
  flaps: { slot: 'alarmFlaps', blocks: ['flaps1', 'flaps2', 'flaps3', 'flaps4'] },
  radioPilot: { slot: 'alarmRadioPilot', blocks: ['radioPilot'] },
  radioCopilot: { slot: 'alarmRadioCopilot', blocks: ['radioCopilot1', 'radioCopilot2'] },
};

const alarmOfSlot = (slot: SlotId): AlarmId | undefined =>
  ALARM_IDS.find((id) => ALARMS[id].slot === slot);

/** The face-up Alarm that blocks `slot`, if any. */
export const alarmBlocking = (
  alarms: { active: readonly AlarmId[] } | null,
  slot: SlotId,
): AlarmId | undefined => alarms?.active.find((id) => ALARMS[id].blocks.includes(slot));

/** The tokens a game with these modules uses: all six, unless a module keeps only some. */
export const alarmPool = (modules: readonly RuleModule[]): readonly AlarmId[] =>
  modules.find((m) => m.alarmTokens)?.alarmTokens ?? ALARM_IDS;

/**
 * Alarms (Turbulence): the tokens start face down. At the start of each round, every Alarm
 * symbol on the current approach space flips a random face-down token: its Action can take
 * no die until a die of the color and number printed on the token is placed on it, which
 * removes the token (that die is used up for the round). Coffee may change the die. Alarms
 * never prevent a landing; an Alarm on Concentration only stops new coffee.
 */
export const alarms: RuleModule = {
  id: 'alarms',
  setup(state, modules) {
    state.alarms = { active: [], faceDown: [...alarmPool(modules)] };
  },
  startOfRound(state) {
    const board = state.alarms;
    if (!board) return;
    const symbols = state.scenario.alarms?.[state.approachIndex] ?? 0;
    for (let i = 0; i < symbols && board.faceDown.length > 0; i++) {
      const r = nextRandom(state.rngState);
      state.rngState = r.rngState;
      const [alarm] = board.faceDown.splice(Math.floor(r.value * board.faceDown.length), 1);
      board.active.push(alarm!);
      state.log.push({ type: 'alarm', round: state.round, alarm: alarm! });
    }
  },
  checkSlot(ctx, slot) {
    const alarm = alarmOfSlot(slot);
    return alarm && ctx.alarms?.active.includes(alarm) ? null : 'alarm-not-active';
  },
  checkAnySlot(ctx, slot) {
    return SLOTS[slot].group !== 'alarm' && alarmBlocking(ctx.alarms, slot)
      ? 'alarm-blocked'
      : null;
  },
  place(state, _seat, slot) {
    const alarm = alarmOfSlot(slot);
    if (state.alarms && alarm) {
      state.alarms.active = state.alarms.active.filter((id) => id !== alarm);
    }
    return undefined;
  },
};
