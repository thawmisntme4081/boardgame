import { CITIES, actingPawn, type CityId, type TableView } from '@pandemic/rules';
import type { BoardProps } from '@platform/ui/game';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionBar } from './components/ActionBar';
import { ForecastDialog } from './components/ForecastDialog';
import { MoveMenu } from './components/MoveMenu';
import { PilesDialog } from './components/PilesDialog';
import { Preflight } from './components/Preflight';
import { MapPieces } from './components/MapPieces';
import { MapTracks } from './components/MapTracks';
import { HandCards } from './components/HandCards';
import { Hands } from './components/Hands';
import { GameOverDialog } from './components/GameOverDialog';
import { EpidemicSteps } from './components/EpidemicSteps';
import { RoleCards } from './components/RoleCards';
import { Prompts } from './components/Prompts';
import { WorldMap } from './components/WorldMap';
import { eventTargets, grantMovesStation, ownerPart } from './lib/events';
import { handLayout, useWide } from './lib/handLayout';
import { MAP_HEIGHT, MAP_WIDTH } from './lib/mapGeometry';
import { platform } from './platform';
import { useDeal } from './lib/deal';
import { reachableCities } from './lib/moves';
import { usePandemic } from './store';

export function Board({ view: live, presence, rematch }: BoardProps<TableView>) {
  const { t } = useTranslation('pandemic');
  const { view, dealing, progress: deal } = useDeal(live);
  const selected = usePandemic((s) => s.selectedCity);
  const selectCity = usePandemic((s) => s.selectCity);
  const movingPawn = usePandemic((s) => s.movingPawn);
  const eventPlan = usePandemic((s) => s.eventPlan);
  const planEvent = usePandemic((s) => s.planEvent);
  const hoverCity = usePandemic((s) => s.hoverCity);
  const layout = handLayout(useWide());
  const canMoveNow =
    !dealing &&
    view.status === 'playing' &&
    !!view.you &&
    view.you === view.turn.seat &&
    view.turn.step === 'actions';

  const reachable = useMemo(() => {
    if (view.status === 'waiting' || view.status === 'setup' || !view.you) return new Set<CityId>();
    const pawn = movingPawn ?? actingPawn(view, view.you);
    return canMoveNow ? reachableCities(view, view.you, CITIES, pawn) : new Set<CityId>();
  }, [view, movingPawn, canMoveNow]);
  // The last seat can be taken a moment before the game is dealt: nothing to show yet.
  // The last seat can be taken a moment before the game is dealt: nothing to show yet. Then the
  // "before the game" step: turn order, roles, confirm.
  if (view.status === 'waiting') return null;
  if (view.status === 'setup') return <Preflight view={view} presence={presence} />;
  const { you } = view;
  const pawn = movingPawn ?? (you ? actingPawn(view, you) : null);
  // Playing an event that needs a city: the map offers its targets instead of the move menu.
  const targets = you ? eventTargets(view, you, eventPlan) : null;
  const chooseTarget = (city: CityId) => {
    if (eventPlan?.event === 'airlift' && eventPlan.pawn !== null) {
      void platform().send({
        type: 'play-event',
        event: 'airlift',
        ...(you ? ownerPart(you, eventPlan.owner) : {}),
        pawn: eventPlan.pawn,
        to: city,
      });
      planEvent(null);
    } else if (eventPlan?.event === 'government-grant') {
      if (grantMovesStation(view)) {
        planEvent({ event: 'government-grant', owner: eventPlan.owner, city });
      } else {
        void platform().send({
          type: 'play-event',
          event: 'government-grant',
          ...(you ? ownerPart(you, eventPlan.owner) : {}),
          city,
        });
        planEvent(null);
      }
    }
  };
  const mapRatio = MAP_WIDTH / (MAP_HEIGHT + (you ? layout.bandHeight : 0));
  return (
    <main className="mx-auto flex min-h-0 w-full flex-1 flex-col gap-3 overflow-hidden px-3 py-3">
      <div className="grid min-h-0 flex-1 grid-cols-[auto_minmax(16rem,34rem)] justify-center gap-3">
        <div className="flex min-h-0 flex-col gap-3">
          <div
            className="h-full min-h-0 max-w-[calc(100dvw-22rem)]"
            style={{ aspectRatio: mapRatio }}
          >
            <WorldMap
              cures={view.cures}
              onSelect={
                targets
                  ? (city) => targets.has(city) && chooseTarget(city)
                  : canMoveNow
                    ? (city) => reachable.has(city) && selectCity(selected === city ? null : city)
                    : undefined
              }
              onBackgroundClick={() => selectCity(null)}
              selected={targets ? null : selected}
              highlight={hoverCity}
              reachable={targets ?? reachable}
              hand={
                you ? (
                  <HandCards
                    cards={view.hands[you] ?? []}
                    discard={view.playerDiscard}
                    layout={layout}
                    // Over the hand limit: pick a card here to discard it.
                    onPick={
                      view.pending?.kind === 'discard' && view.pending.seat === you
                        ? (card) => void platform().send({ type: 'discard', card })
                        : undefined
                    }
                  />
                ) : undefined
              }
              handHeight={layout.bandHeight}
            >
              <MapTracks view={view} deal={deal} />
              <MapPieces view={view} presence={presence} />
              {!targets && canMoveNow && selected && you && (
                <MoveMenu
                  view={view}
                  you={you}
                  pawn={pawn ?? you}
                  city={selected}
                  presence={presence}
                  onDone={() => selectCity(null)}
                />
              )}
            </WorldMap>
          </div>
        </div>
        <aside className="flex min-h-0 flex-col gap-3 overflow-auto">
          <RoleCards view={view} presence={presence} />
          <Prompts view={view} presence={presence} />
          <ForecastDialog view={view} />
          <PilesDialog view={view} />
          {view.status !== 'playing' && (
            <div
              role="alert"
              className="rounded-lg border border-yellow-400 bg-yellow-100 p-3 text-sm text-yellow-950"
            >
              <p className="font-semibold">
                {view.status === 'won'
                  ? t('board.won')
                  : t('board.lost', {
                      reason: view.lossReason ? t(`board.lossReason.${view.lossReason}`) : '',
                    })}
              </p>
            </div>
          )}
          <EpidemicSteps view={view} />
          <GameOverDialog view={view} presence={presence} rematch={rematch} />
          <Hands view={view} presence={presence} />
          {view.status === 'playing' && !dealing && <ActionBar view={view} presence={presence} />}
        </aside>
      </div>
    </main>
  );
}
