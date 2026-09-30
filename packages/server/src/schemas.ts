import { ABILITY_IDS, DICE_PER_SEAT, MAX_COFFEE, SLOT_IDS } from '@sky/shared';
import { z } from 'zod';

export const ROOM_CODE_LENGTH = 4;

const name = z.string().trim().min(1).max(20);
const code = z
  .string()
  .trim()
  .regex(new RegExp(`^[A-Za-z]{${ROOM_CODE_LENGTH}}$`))
  .transform((c) => c.toUpperCase());
const dieId = z.string().min(1).max(20);

/** Scenario and abilities are checked against each other in `resolveSetup`. */
const setup = {
  scenario: z.string().min(1).max(20).optional(),
  abilities: z.array(z.enum(ABILITY_IDS)).max(ABILITY_IDS.length).optional(),
};

export const createRoomSchema = z.object({ name, timer: z.boolean().optional(), ...setup });
/** `game:rematch`: `{}` (or nothing) keeps the scenario. */
export const rematchSchema = z.object(setup).optional();
export const joinRoomSchema = z.object({ code, name });
export const rejoinRoomSchema = z.object({ code, token: z.uuid() });
/** Events without data: `{}` or nothing. */
export const emptySchema = z.object({}).optional();

export const placeSchema = z.object({
  dieId,
  slot: z.enum(SLOT_IDS),
  coffeeDelta: z.number().int().min(-MAX_COFFEE).max(MAX_COFFEE),
  tokenSlot: z.enum(SLOT_IDS).optional(),
});
export const abilitySchema = z.object({
  ability: z.enum(['adaptation', 'anticipation', 'working-together']),
  dieId,
});
export const rerollSchema = z.object({ dieIds: z.array(dieId).max(DICE_PER_SEAT) });
