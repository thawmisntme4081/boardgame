// Plays N random games (default 1000) and prints how they ended.
// Usage: pnpm --filter @pandemic/rules random-play [games] [firstSeed] [players] [epidemics]
import { playRandomGame } from '@platform/engine/testing';
import { pandemic } from '../src/definition';
import { agentMove } from '../src/random-play';
import { SEATS } from '../src/types';

const games = Number(process.argv[2] ?? 1000);
const firstSeed = Number(process.argv[3] ?? 1);
const players = Number(process.argv[4] ?? 0);
const epidemics = Number(process.argv[5] ?? 4);

const outcomes = new Map<string, number>();
let moves = 0;
for (let seed = firstSeed; seed < firstSeed + games; seed++) {
  // Without a player count, the games cycle through 2, 3 and 4 players.
  const count = players || 2 + (seed % 3);
  const played = playRandomGame({
    definition: pandemic,
    config: { players: count, epidemics },
    seats: SEATS.slice(0, count),
    seed,
    nextMove: (state, random) => agentMove(state, random),
    maxSteps: 5000,
  });
  const { outcome } = played;
  const key =
    outcome.kind === 'coop' ? (outcome.won ? 'won' : `lost: ${outcome.reasons.join()}`) : 'other';
  outcomes.set(key, (outcomes.get(key) ?? 0) + 1);
  moves += played.moves.length;
}
console.log(
  `${games} games (${players || '2-4'} players, ${epidemics} epidemics), average ${(moves / games).toFixed(0)} moves`,
);
for (const [key, count] of [...outcomes].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${key.padEnd(20)} ${count}`);
}
