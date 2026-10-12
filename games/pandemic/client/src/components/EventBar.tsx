import {
  canActInView,
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
import type { EventPlan } from '../lib/events';
import { cityName, seatName } from '../lib/names';
import { platform } from '../platform';
import { usePandemic } from '../store';

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
            {view.seats.map((seat) => (
              <Button
                key={seat}
                variant="outline"
                size="sm"
                onClick={() => planEvent({ event: 'airlift', pawn: seat })}
              >
                {t('eventBar.pawnAt', {
                  name: seatName(presence, seat),
                  city: cityName(view.pawns[seat] as CityId),
                })}
              </Button>
            ))}
            {cancel}
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm">
          {t('eventBar.airliftCity', { name: seatName(presence, plan.pawn) })}
        </p>
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
                send({ type: 'play-event', event: 'government-grant', city, move: station })
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
              city: removed,
            })
          }
          onClick={() =>
            removed !== '' &&
            send({ type: 'play-event', event: 'resilient-population', city: removed })
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
 * Your event cards, in hand and on the Contingency Planner's role card, each with a "Play"
 * button when the rules allow it now: on your turn or not, never while a card is being resolved.
 * Forecast and One Quiet Night are played at once; the others ask for their choices here and on
 * the map (`eventPlan`).
 */
export function EventBar({
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
  const events = heldEvents(view, you);
  if (events.length === 0) return null;
  // The card on the role card, when this seat has one, is the last of `heldEvents`.
  const storedIndex =
    view.contingency !== null && roleOf(view, you)?.storesEvent ? events.length - 1 : -1;

  const play = (event: EventId) => {
    switch (event) {
      case 'forecast':
      case 'one-quiet-night':
        void platform().send({ type: 'play-event', event });
        return;
      case 'airlift':
        planEvent({ event, pawn: null });
        return;
      case 'government-grant':
        planEvent({ event, city: null });
        return;
      case 'resilient-population':
        planEvent({ event });
        return;
    }
  };

  return (
    <section aria-labelledby="events-title" className="flex flex-col gap-2 rounded-lg border p-3">
      <h2 id="events-title" className="font-semibold">
        {t('eventBar.title')}
      </h2>
      <ul className="flex flex-col gap-1">
        {events.map((event, i) => (
          <li key={`${event}-${i}`} className="flex items-center justify-between gap-2 text-sm">
            <span>
              {t(`events.${event}`)}
              {i === storedIndex && (
                <span className="ml-1 text-muted-foreground">({t('eventBar.onRole')})</span>
              )}
            </span>
            <Button
              size="sm"
              disabled={!canPlayCard(view, you, event) || plan !== null}
              onClick={() => play(event)}
            >
              {t('eventBar.play')}
            </Button>
          </li>
        ))}
      </ul>
      {plan && <PlanStep view={view} you={you} plan={plan} presence={presence} />}
    </section>
  );
}
