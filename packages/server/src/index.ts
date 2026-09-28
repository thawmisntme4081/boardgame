import { createGameServer } from './app';

const PORT = Number(process.env.PORT ?? 3000);

const { httpServer } = createGameServer();

httpServer.listen(PORT, () => {
  console.log(`server listening on http://localhost:${PORT}`);
});
