import { z } from 'zod';

export const ROOM_CODE_LENGTH = 4;

const name = z.string().trim().min(1).max(20);
const code = z
  .string()
  .trim()
  .regex(new RegExp(`^[A-Za-z]{${ROOM_CODE_LENGTH}}$`))
  .transform((c) => c.toUpperCase());

export const createRoomSchema = z.object({ name });
export const joinRoomSchema = z.object({ code, name });
export const rejoinRoomSchema = z.object({ code, token: z.uuid() });
export const readySchema = z.object({}).optional();
