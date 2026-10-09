import {
  COLORS,
  MAX_STATIONS,
  canActInView,
  cardsToCure,
  cityOf,
  type CityId,
  type Color,
  type PandemicMove,
  type PandemicView,
  type SeatId,
} from '@pandemic/rules';
import { Button } from '@platform/ui/components/button';
import type { SeatPresence } from '@platform/ui/game';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cityName, seatName } from '../lib/names';
import { platform } from '../platform';

const send = (move: PandemicMove) => void platform().send(move);

const selectClass = 'h-11 rounded-md border bg-background px-2 text-sm';

/** Every city card of `color` in the hand: the cards a cure could use. */
function colorCards(view: PandemicView, seat: SeatId, color: Color): CityId[] {
  const hand = view.hands[seat] ?? [];
  return hand
    .flatMap((card) => (card.kind === 'city' ? [card.city] : []))
    .filter((city) => cityOf(city).color === color);
}

/** Every action as a plain button, enabled only where `canActInView` says it is legal. */
export function ActionBar({
  view,
  presence,
}: {
  view: PandemicView;
  presence: SeatPresence | null;
}) {
  const { t } = useTranslation('pandemic');
  const [moveStation, setMoveStation] = useState<CityId | ''>('');
  // A cure with more cards of its color than it needs: the player picks which to discard.
  const [curing, setCuring] = useState<{ color: Color; picked: CityId[] } | null>(null);
  const { you, turn } = view;

  if (!you) return <p className="text-sm text-muted-foreground">{t('actions.spectator')}</p>;
  const can = (move: PandemicMove) => canActInView(view, you, move);
  const stationsFull = view.stations.length >= MAX_STATIONS;

  return (
    <section aria-labelledby="actions-title" className="flex flex-col gap-3">
      <h2 id="actions-title" className="font-semibold">
        {t('actions.title')}
      </h2>
      {turn.seat !== you && (
        <p className="text-sm text-muted-foreground">{t('actions.notYourTurn')}</p>
      )}
      <p className="text-sm text-muted-foreground">{t('actions.moveHint')}</p>

      <div className="flex flex-wrap items-center gap-2">
        {stationsFull && (
          <select
            aria-label={t('actions.moveStation')}
            className={selectClass}
            value={moveStation}
            onChange={(e) => setMoveStation(e.target.value as CityId | '')}
          >
            <option value="">{t('actions.moveStation')}</option>
            {view.stations.map((id) => (
              <option key={id} value={id}>
                {cityName(id)}
              </option>
            ))}
          </select>
        )}
        <Button
          variant="outline"
          disabled={!can({ type: 'build', ...(moveStation ? { move: moveStation } : {}) })}
          onClick={() => send({ type: 'build', ...(moveStation ? { move: moveStation } : {}) })}
        >
          {t('actions.build')}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {COLORS.map((color) => (
          <Button
            key={`treat-${color}`}
            variant="outline"
            disabled={!can({ type: 'treat', color })}
            onClick={() => send({ type: 'treat', color })}
          >
            {t('actions.treat', { color: t(`color.${color}`) })}
          </Button>
        ))}
        {COLORS.map((color) => {
          const owned = colorCards(view, you, color);
          const needed = cardsToCure();
          // Which cards makes no difference to whether a cure is legal, only how many.
          const first = owned.slice(0, needed);
          return (
            <Button
              key={`cure-${color}`}
              variant="outline"
              disabled={!can({ type: 'cure', color, cards: first })}
              onClick={() =>
                owned.length > needed
                  ? setCuring({ color, picked: [] })
                  : send({ type: 'cure', color, cards: first })
              }
            >
              {t('actions.cure', { color: t(`color.${color}`) })}
            </Button>
          );
        })}
      </div>

      {curing && (
        <fieldset className="flex flex-col gap-2 rounded-md border p-2">
          <legend className="px-1 text-sm font-medium">
            {t('actions.cureChoose', {
              color: t(`color.${curing.color}`),
              count: cardsToCure(),
            })}
          </legend>
          <div className="flex flex-wrap gap-2">
            {colorCards(view, you, curing.color).map((city) => {
              const on = curing.picked.includes(city);
              return (
                <Button
                  key={city}
                  size="sm"
                  variant={on ? 'default' : 'outline'}
                  aria-pressed={on}
                  onClick={() =>
                    setCuring({
                      ...curing,
                      picked: on
                        ? curing.picked.filter((picked) => picked !== city)
                        : [...curing.picked, city],
                    })
                  }
                >
                  {cityName(city)}
                </Button>
              );
            })}
          </div>
          <p className="text-sm text-muted-foreground">
            {t('actions.cureChosen', { chosen: curing.picked.length, count: cardsToCure() })}
          </p>
          <div className="flex gap-2">
            <Button
              disabled={!can({ type: 'cure', color: curing.color, cards: curing.picked })}
              onClick={() => {
                send({ type: 'cure', color: curing.color, cards: curing.picked });
                setCuring(null);
              }}
            >
              {t('actions.cureConfirm')}
            </Button>
            <Button variant="ghost" onClick={() => setCuring(null)}>
              {t('actions.cureCancel')}
            </Button>
          </div>
        </fieldset>
      )}

      <div className="flex flex-wrap gap-2">
        {view.seats
          .filter((seat) => seat !== you)
          .flatMap((seat) =>
            (['give', 'take'] as const).map((direction) => {
              const offer = { type: 'share-offer', direction, with: seat } as const;
              return (
                <Button
                  key={`${direction}-${seat}`}
                  variant="outline"
                  disabled={!can(offer)}
                  onClick={() => send(offer)}
                >
                  {t(`share.${direction}`, { name: seatName(presence, seat) })}
                </Button>
              );
            }),
          )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button disabled={!can({ type: 'draw' })} onClick={() => send({ type: 'draw' })}>
          {t('actions.draw')}
        </Button>
        <Button disabled={!can({ type: 'epidemic' })} onClick={() => send({ type: 'epidemic' })}>
          {t('actions.epidemic', { step: t(`board.epidemicStep.${turn.epidemicStep}`) })}
        </Button>
        <Button disabled={!can({ type: 'infect' })} onClick={() => send({ type: 'infect' })}>
          {t('actions.infect')}
        </Button>
        <Button
          variant="ghost"
          disabled={!can({ type: 'pass' })}
          onClick={() => send({ type: 'pass' })}
        >
          {t('actions.pass')}
        </Button>
      </div>
    </section>
  );
}
