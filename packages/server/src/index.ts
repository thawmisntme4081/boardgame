import { createGameServer } from './app';
import { DEFAULT_IDLE_TTL_MS, DEFAULT_MAX_ROOMS_PER_IP, RoomManager } from './rooms';

const PORT = Number(process.env.PORT ?? 3000);
const ttlMinutes = Number(process.env.ROOM_TTL_MINUTES);
const roomsPerIp = Number(process.env.ROOMS_PER_IP);

const rooms = new RoomManager({
  idleTtlMs: ttlMinutes > 0 ? ttlMinutes * 60_000 : DEFAULT_IDLE_TTL_MS,
  maxRoomsPerIp: roomsPerIp > 0 ? roomsPerIp : DEFAULT_MAX_ROOMS_PER_IP,
});
const { httpServer } = createGameServer(rooms, { trustProxy: process.env.TRUST_PROXY === '1' });

httpServer.listen(PORT, () => {
  console.log(`server listening on http://localhost:${PORT}`);
});
