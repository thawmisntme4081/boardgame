import type { PlayerView, Presence } from '@sky/rules';
import { SetupNote } from './notes';
import { PlacingTray } from './PlacingTray';
import { RerollTray } from './RerollTray';
import { StrategyTray } from './StrategyTray';

/** The bottom tray, by phase: before take-off, strategy, rerolling, or placing dice. */
export function DiceTray({ view, presence }: { view: PlayerView; presence: Presence | null }) {
  if (view.phase === 'setup') return <SetupNote />;
  if (view.phase === 'strategy') return <StrategyTray view={view} presence={presence} />;
  if (view.phase !== 'placing') return null;
  if (view.rerollPending[view.seat]) return <RerollTray view={view} presence={presence} />;
  return <PlacingTray view={view} presence={presence} />;
}
