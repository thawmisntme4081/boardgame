import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGameServer } from './app';
import { DEFAULT_IDLE_TTL_MS, DEFAULT_MAX_ROOMS_PER_IP, RoomManager } from './rooms';

const PORT = Number(process.env.PORT ?? 3000);
const production = process.env.NODE_ENV === 'production';
const ttlMinutes = Number(process.env.ROOM_TTL_MINUTES);
const roomsPerIp = Number(process.env.ROOMS_PER_IP);
// Fixed dice and test routes are for development and E2E tests only.
const gameSeed = production ? NaN : Number(process.env.GAME_SEED);
const e2eHooks = !production && process.env.E2E_HOOKS === '1';

const rooms = new RoomManager({
  idleTtlMs: ttlMinutes > 0 ? ttlMinutes * 60_000 : DEFAULT_IDLE_TTL_MS,
  maxRoomsPerIp: roomsPerIp > 0 ? roomsPerIp : DEFAULT_MAX_ROOMS_PER_IP,
  ...(Number.isInteger(gameSeed) && { seed: () => gameSeed }),
});

// Same path from src/ (tsx) and dist/ (built): packages/client/dist.
const clientDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');

const { httpServer } = createGameServer(rooms, {
  trustProxy: process.env.TRUST_PROXY === '1',
  clientDir,
  e2eHooks,
});

httpServer.listen(PORT, () => {
  console.log(`server listening on http://localhost:${PORT}`);
  if (e2eHooks) console.log('E2E test routes are ON (never in production)');
  if (Number.isInteger(gameSeed)) console.log(`every game uses seed ${gameSeed}`);
});
