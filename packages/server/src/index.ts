import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGameServer } from './app';
import { DEFAULT_IDLE_TTL_MS, DEFAULT_MAX_ROOMS_PER_IP, RoomManager } from './rooms';
import { databaseFile, SqliteRoomStore } from './store';

const PORT = Number(process.env.PORT ?? 3000);
const production = process.env.NODE_ENV === 'production';
const ttlMinutes = Number(process.env.ROOM_TTL_MINUTES);
const roomsPerIp = Number(process.env.ROOMS_PER_IP);
// Fixed dice and test routes are for development and E2E tests only.
const gameSeed = production ? NaN : Number(process.env.GAME_SEED);
const e2eHooks = !production && process.env.E2E_HOOKS === '1';
// A short round timer, to try timed games without waiting 3 minutes (never in production).
const roundTimerSeconds = production ? NaN : Number(process.env.ROUND_TIMER_SECONDS);
// Where games are saved (the Fly volume in production); without it, games live in memory.
const dataDir = process.env.DATA_DIR;
const dbFile = dataDir ? databaseFile(dataDir) : undefined;

const rooms = new RoomManager({
  idleTtlMs: ttlMinutes > 0 ? ttlMinutes * 60_000 : DEFAULT_IDLE_TTL_MS,
  maxRoomsPerIp: roomsPerIp > 0 ? roomsPerIp : DEFAULT_MAX_ROOMS_PER_IP,
  ...(Number.isInteger(gameSeed) && { seed: () => gameSeed }),
  ...(roundTimerSeconds > 0 && { roundTimerMs: roundTimerSeconds * 1000 }),
  ...(dbFile && { store: new SqliteRoomStore(dbFile) }),
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
  if (roundTimerSeconds > 0) console.log(`timed rounds last ${roundTimerSeconds} s`);
  if (dbFile) console.log(`games saved in ${dbFile} (${rooms.size} rooms loaded)`);
  else if (production) console.warn('DATA_DIR is not set: games are lost when the server stops');
});

// Fly stops the machine when nobody is connected: write pending saves before exiting.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    rooms.close();
    process.exit(0);
  });
}
