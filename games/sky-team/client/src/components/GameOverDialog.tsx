import type { RematchState } from '@platform/ui/game';
import { SCENARIOS, type PlayerView, type Presence } from '@sky/rules';
import {
  CircleCheck,
  CircleX,
  Hourglass,
  OctagonAlert,
  PlaneLanding,
  PlaneTakeoff,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { declineRematch, leaveGame, rematch as rematch_ } from '../api';
import { partnerOf } from '../partner';
import { FlightLog } from './FlightLog';
import { DifficultyDot, ScenarioPicker } from './ScenarioPicker';
import { Button } from '@platform/ui/components/button';
import { DialogFooter } from '@platform/ui/components/dialog';
import { GameOverFrame, OfferNote } from '@platform/ui/GameOver';
import { cn } from '@platform/ui/utils';
import { formatNumber } from '../i18n';
import { useSkyTeam } from '../store';
import { endReasonText } from '../messages';
import { difficultyName } from '../scenarioText';

/**
 * "Fly again" needs both players: the first to press it makes an offer (their scenario), the
 * other accepts with their own "Fly again" or says "Not now". Offers and answers come from
 * the server (`rematch`); nothing restarts until both agree.
 */
function RematchForm({
  view,
  won,
  presence,
  rematch,
}: {
  view: PlayerView;
  won: boolean;
  presence: Presence | null;
  rematch: RematchState;
}) {
  const { t } = useTranslation('sky-team');
  const [setup, setSetup] = useState({ scenario: view.scenario.id });
  const partner = partnerOf(view, presence);
  const flyClass = cn('h-11', won && 'bg-emerald-600 text-white hover:bg-emerald-700');
  const leave = (
    <Button variant="outline" className="h-11" onClick={() => void leaveGame()}>
      {t('gameOver.leave')}
    </Button>
  );

  if (rematch.by === view.seat) {
    return (
      <>
        <OfferNote icon={Hourglass}>{t('gameOver.offerWaiting', { name: partner.name })}</OfferNote>
        <DialogFooter className="gap-2">
          {leave}
          <Button variant="outline" className="h-11" onClick={() => void declineRematch()}>
            {t('gameOver.cancelOffer')}
          </Button>
        </DialogFooter>
      </>
    );
  }
  if (rematch.by !== null) {
    const offered = SCENARIOS[(rematch.config as { scenario?: string } | null)?.scenario ?? ''];
    return (
      <>
        <OfferNote icon={PlaneTakeoff}>
          {t('gameOver.offered', { name: partner.name })}
          {offered && ` ${offered.name}`}
        </OfferNote>
        <DialogFooter className="gap-2">
          {leave}
          <Button className={flyClass} onClick={() => void rematch_()}>
            {t('gameOver.flyAgain')}
          </Button>
        </DialogFooter>
      </>
    );
  }
  return (
    <>
      <ScenarioPicker id="rematch" value={setup} onChange={setSetup} />
      <p className="text-xs text-muted-foreground">
        {t('gameOver.scenarioNote', { name: partner.name })}
      </p>
      <DialogFooter className="gap-2">
        {leave}
        <Button className={flyClass} onClick={() => void rematch_(setup)}>
          {t('gameOver.flyAgain')}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * The end of the game. A win and a loss look different at a glance: a green band with a
 * landing plane, or a red band with an alert, and a matching border.
 */
export function GameOverDialog({
  view,
  presence,
  rematch,
}: {
  view: PlayerView;
  presence: Presence | null;
  rematch: RematchState;
}) {
  const { t } = useTranslation('sky-team');
  const over = view.phase === 'won' || view.phase === 'lost';
  const won = view.phase === 'won';
  const reasons = view.landingFailures ?? (view.endReason ? [view.endReason] : []);
  const Icon = won ? PlaneLanding : OctagonAlert;
  // "View board" hides the dialog to look at the final board; a banner brings it back. A
  // rematch offer (or taking one back) shows the dialog again, so nobody misses it.
  const [hiddenFor, setHiddenFor] = useState<string | null | false>(false);
  const setViewingBoard = useSkyTeam((s) => s.setViewingBoard);
  const hidden = hiddenFor !== false && hiddenFor === rematch.by;

  return (
    <GameOverFrame
      over={over}
      won={won}
      icon={Icon}
      title={won ? t('gameOver.landed') : t('gameOver.crashed')}
      description={
        won
          ? t('gameOver.landedAt', { airport: view.scenario.airport, round: view.round })
          : t('gameOver.crashedAt', { round: view.round, altitude: formatNumber(view.altitude) })
      }
      hidden={hidden}
      onHideResult={() => {
        setHiddenFor(rematch.by);
        setViewingBoard(true);
      }}
      onShowResult={() => {
        setHiddenFor(false);
        setViewingBoard(false);
      }}
      viewBoardLabel={t('gameOver.viewBoard')}
      showResultLabel={t('gameOver.showResult')}
      extras={<FlightLog />}
    >
      {won ? (
        <p className="flex items-center gap-2 text-sm">
          <DifficultyDot scenario={view.scenario} />
          <span className="font-medium">{view.scenario.name}</span>
          <span className="text-muted-foreground">
            · {difficultyName(view.scenario.difficulty)}
          </span>
          <CircleCheck aria-label={t('gameOver.done')} className="size-4 text-emerald-600" />
        </p>
      ) : (
        <ul className="space-y-1.5 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm">
          {reasons.map((reason) => (
            <li key={reason} className="flex items-start gap-2">
              <CircleX aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-danger" />
              {endReasonText(reason)}
            </li>
          ))}
        </ul>
      )}
      <RematchForm view={view} won={won} presence={presence} rematch={rematch} />
    </GameOverFrame>
  );
}
