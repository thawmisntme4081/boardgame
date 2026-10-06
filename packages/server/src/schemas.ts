import { z } from 'zod';

export const ROOM_CODE_LENGTH = 4;

const name = z.string().trim().min(1).max(20);
const code = z
  .string()
  .trim()
  .regex(new RegExp(`^[A-Za-z]{${ROOM_CODE_LENGTH}}$`))
  .transform((c) => c.toUpperCase());

/** The scenario is checked by the game's `configSchema`; roles and abilities are chosen in the game. */
const setup = {
  scenario: z.string().min(1).max(20).optional(),
};

export const createRoomSchema = z.object({ name, timer: z.boolean().optional(), ...setup });
/** `game:rematch`: `{}` (or nothing) keeps the scenario. */
export const rematchSchema = z.object(setup).optional();
export const joinRoomSchema = z.object({ code, name });
export const rejoinRoomSchema = z.object({ code, token: z.uuid() });
/** Events without data: `{}` or nothing. */
export const emptySchema = z.object({}).optional();
export const chooseSeatSchema = z.object({ seat: z.enum(['pilot', 'copilot']) });
