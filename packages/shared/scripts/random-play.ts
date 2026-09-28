// Plays N random games (default 1000) and prints how they ended.
// Usage: pnpm --filter @sky/shared random-play [games] [firstSeed]
import { playRandomGame } from '../src/random-play';

const games = Number(process.argv[2] ?? 1000);
const firstSeed = Number(process.argv[3] ?? 1);
const outcomes = new Map<string, number>();
let rounds = 0;

for (let seed = firstSeed; seed < firstSeed + games; seed++) {
  const end = playRandomGame(seed);
  const key = end.phase === 'won' ? 'won' : `lost: ${end.endReason}`;
  outcomes.set(key, (outcomes.get(key) ?? 0) + 1);
  rounds += end.round;
}

console.log(`${games} games, average last round ${(rounds / games).toFixed(2)}`);
for (const [key, count] of [...outcomes].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${key.padEnd(28)} ${count}`);
}
