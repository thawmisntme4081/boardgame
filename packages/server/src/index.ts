import express from 'express';
import { SEATS } from '@sky/shared';

const PORT = Number(process.env.PORT ?? 3000);

const app = express();

app.get('/health', (_req, res) => {
  res.json({ ok: true, seats: SEATS });
});

app.listen(PORT, () => {
  console.log(`server listening on http://localhost:${PORT}`);
});
