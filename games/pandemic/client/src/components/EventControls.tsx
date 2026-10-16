import {
  pawnOwner,
  pawnsOnMap,
  canActInView,
  carriesAlong,
  canPlayCard,
  heldEvents,
  roleOf,
  type CityId,
  type EventId,
  type PandemicMove,
  type PandemicView,
  type SeatId,
} from '@pandemic/rules';
import { Button } from '@platform/ui/components/button';
import type { SeatPresence } from '@platform/ui/game';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ownerPart, type EventPlan } from '../lib/events';
import { cityName, pawnName, seatName } from '../lib/names';
import { platform } from '../platform';
import { usePandemic } from '../store';
import { CarryPicker } from './CarryPicker';

/** The next step of the card being played, once it needs a choice. */
function PlanStep({
  view,
  you,
  plan,
  presence,
}: {
  view: PandemicView;
  you: SeatId;
  plan: EventPlan;
  presence: SeatPresence | null;
}) {
  const { t } = useTranslation('pandemic');
  const planEvent = usePandemic((s) => s.planEvent);
  const [removed, setRemoved] = useState<CityId | ''>('');
  const cancel = (
    <Button variant="outline" size="sm" onClick={() => planEvent(null)}>
      {t('eventBar.cancel')}
    </Button>
  );
  const send = (move: PandemicMove) => {
    void platform().send(move);
    planEvent(null);
  };

  if (plan.event === 'airlift') {
    if (plan.pawn === null) {
      return (
        <div className="flex flex-col gap-2">
          <p className="text-sm">{t('eventBar.airliftPawn')}</p>
          <div className="flex flex-wrap gap-1">
            {pawnsOnMap(view).map((pawn) => (
              <Button
                key={pawn}
                variant="outline"
                size="sm"
                onClick={() => planEvent({ event: 'airlift', owner: plan.owner, pawn })}
              >
                {t('eventBar.pawnAt', {
                  name: pawnName(presence, pawn),
                  city: cityName(view.pawns[pawn] as CityId),
                })}
              </Button>
            ))}
            {cancel}
          </div>
        </div>
      );
    }
    // Your own pawn, if it takes things along (Relocation Specialist), chooses them first.
    const carrying = pawnOwner(plan.pawn) === you && carriesAlong(view, plan.pawn);
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm">
          {t('eventBar.airliftCity', { name: pawnName(presence, plan.pawn) })}
        </p>
        {carrying && <CarryPicker view={view} pawn={plan.pawn} presence={presence} />}
        <div>{cancel}</div>
      </div>
    );
  }

  if (plan.event === 'government-grant') {
    if (plan.city === null) {
      return (
        <div className="flex flex-col gap-2">
          <p className="text-sm">{t('eventBar.grantCity')}</p>
          <div>{cancel}</div>
        </div>
      );
    }
    const { city } = plan;
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm">{t('eventBar.grantMove', { city: cityName(city) })}</p>
        <div className="flex flex-wrap gap-1">
          {view.stations.map((station) => (
            <Button
              key={station}
              variant="outline"
              size="sm"
              onClick={() =>
                send({
                  type: 'play-event',
                  event: 'government-grant',
                  ...ownerPart(you, plan.owner),
                  city,
                  move: station,
                })
              }
            >
              {cityName(station)}
            </Button>
          ))}
          {cancel}
        </div>
      </div>
    );
  }

  // Resilient Population: one of the cards of the infection discard pile.
  const choices = [...new Set(view.infectionDiscard)].sort();
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">{t('eventBar.population')}</p>
      <select
        aria-label={t('eventBar.population')}
        className="rounded-md border bg-background px-2 py-1 text-sm"
        value={removed}
        onChange={(e) => setRemoved(e.target.value as CityId | '')}
      >
        <option value="" />
        {choices.map((city) => (
          <option key={city} value={city}>
            {cityName(city)}
          </option>
        ))}
      </select>
      <div className="flex gap-1">
        <Button
          size="sm"
          disabled={
            removed === '' ||
            !canActInView(view, you, {
              type: 'play-event',
              event: 'resilient-population',
              ...ownerPart(you, plan.owner),
              city: removed,
            })
          }
          onClick={() =>
            removed !== '' &&
            send({
              type: 'play-event',
              event: 'resilient-population',
              ...ownerPart(you, plan.owner),
              city: removed,
            })
          }
        >
          {t('eventBar.removeCard')}
        </Button>
        {cancel}
      </div>
    </div>
  );
}

/**
 * Every event card on the table, in hands and on the Contingency Planner's role card, yours
 * first, each with a "Play" button when the rules allow it now: on your turn or not, never while a
 * card is being resolved. Anyone may play anyone's card.
 * Forecast and One Quiet Night are played at once; the others ask for their choices below the
 * buttons and on the map (`eventPlan`). Drawn inside the action bar.
 */
export function EventControls({
  view,
  presence,
}: {
  view: PandemicView;
  presence: SeatPresence | null;
}) {
  const { t } = useTranslation('pandemic');
  const plan = usePandemic((s) => s.eventPlan);
  const planEvent = usePandemic((s) => s.planEvent);
  const { you } = view;
  if (!you || view.status !== 'playing') return null;
  // Every event card on the table, yours first: anyone may play anyone's card.
  const owners = [...view.seats].sort((a, b) => Number(b === you) - Number(a === you));
  const cards = owners.flatMap((owner) => {
    const events = heldEvents(view, owner);
    // The card on the role card, when the owner has one, is the last of `heldEvents`.
    const storedIndex =
      view.contingency !== null && roleOf(view, owner)?.storesEvent ? events.length - 1 : -1;
    return events.map((event, i) => ({ owner, event, stored: i === storedIndex }));
  });
  if (cards.length === 0) return null;

  const play = (event: EventId, owner: SeatId) => {
    switch (event) {
      case 'forecast':
      case 'one-quiet-night':
        void platform().send({ type: 'play-event', event, ...ownerPart(you, owner) });
        return;
      case 'airlift':
        planEvent({ event, owner, pawn: null });
        return;
      case 'government-grant':
        planEvent({ event, owner, city: null });
        return;
      case 'resilient-population':
        planEvent({ event, owner });
        return;
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {cards.map(({ owner, event }, i) => {
          const label = t('eventBar.playEvent', {
            event: t(`events.${event}`),
          });
          return (
            <Button
              key={`${owner}-${event}-${i}`}
              variant="outline"
              disabled={!canPlayCard(view, you, event, owner) || plan !== null}
              onClick={() => play(event, owner)}
            >
              {owner === you
                ? label
                : t('eventBar.ofPlayer', { label, name: seatName(presence, owner) })}
            </Button>
          );
        })}
      </div>
      {plan && <PlanStep view={view} you={you} plan={plan} presence={presence} />}
    </>
  );
}
