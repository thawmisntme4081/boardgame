// Plays N random games (default 1000) and prints how they ended.
// Usage: pnpm --filter @sky/rules random-play [games] [firstSeed] [scenario id | all]
import { ABILITY_IDS } from '../src/abilities';
import { playRandomGame } from '../src/random-play';
import { SCENARIO_LIST, SCENARIOS, YUL } from '../src/scenarios';
import type { Scenario } from '../src/types';

const games = Number(process.argv[2] ?? 1000);
const firstSeed = Number(process.argv[3] ?? 1);
const which = process.argv[4] ?? YUL.id;
const scenarios: readonly Scenario[] = which === 'all' ? SCENARIO_LIST : [SCENARIOS[which]!];
if (scenarios.some((s) => !s)) throw new Error(`unknown scenario ${which}`);

for (const scenario of scenarios) {
  const outcomes = new Map<string, number>();
  let rounds = 0;
  for (let seed = firstSeed; seed < firstSeed + games; seed++) {
    // A different set of Special Abilities each game.
    const abilities = ABILITY_IDS.map(
      (_, i) => ABILITY_IDS[(seed + i) % ABILITY_IDS.length]!,
    ).slice(0, scenario.abilities);
    const end = playRandomGame(seed, scenario, undefined, true, abilities);
    const key = end.phase === 'won' ? 'won' : `lost: ${end.endReason}`;
    outcomes.set(key, (outcomes.get(key) ?? 0) + 1);
    rounds += end.round;
  }
  console.log(`${scenario.id}: ${games} games, average last round ${(rounds / games).toFixed(2)}`);
  for (const [key, count] of [...outcomes].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${key.padEnd(28)} ${count}`);
  }
}
