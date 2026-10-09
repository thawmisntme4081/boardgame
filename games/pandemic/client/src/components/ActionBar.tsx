import {
  CITIES,
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
import { usePandemic } from '../store';

const send = (move: PandemicMove) => void platform().send(move);

const selectClass = 'h-11 rounded-md border bg-background px-2 text-sm';

/** The city cards of `color` in the hand: the cards a cure would use. */
function cureCards(view: PandemicView, seat: SeatId, color: Color): CityId[] {
  const hand = view.hands[seat] ?? [];
  return hand
    .flatMap((card) => (card.kind === 'city' ? [card.city] : []))
    .filter((city) => cityOf(city).color === color)
    .slice(0, cardsToCure());
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
  const target = usePandemic((s) => s.selectedCity);
  const selectCity = usePandemic((s) => s.selectCity);
  const [moveStation, setMoveStation] = useState<CityId | ''>('');
  const { you, turn } = view;

  if (!you) return <p className="text-sm text-muted-foreground">{t('actions.spectator')}</p>;
  const can = (move: PandemicMove) => canActInView(view, you, move);
  const stationsFull = view.stations.length >= MAX_STATIONS;
  const move = (type: 'drive' | 'direct' | 'charter' | 'shuttle') => (
    <Button
      key={type}
      variant="outline"
      disabled={!target || !can({ type, to: target })}
      onClick={() => target && send({ type, to: target })}
    >
      {t(`actions.${type}`)}
    </Button>
  );

  return (
    <section aria-labelledby="actions-title" className="flex flex-col gap-3">
      <h2 id="actions-title" className="font-semibold">
        {t('actions.title')}
      </h2>
      {turn.seat !== you && (
        <p className="text-sm text-muted-foreground">{t('actions.notYourTurn')}</p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        {t('actions.target')}
        <select
          className={selectClass}
          value={target ?? ''}
          onChange={(e) => selectCity((e.target.value || null) as CityId | null)}
        >
          <option value="">{t('actions.targetPlaceholder')}</option>
          {CITIES.map(({ id }) => (
            <option key={id} value={id}>
              {cityName(id)}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        {(['drive', 'direct', 'charter', 'shuttle'] as const).map(move)}
      </div>

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
          const cards = cureCards(view, you, color);
          return (
            <Button
              key={`cure-${color}`}
              variant="outline"
              disabled={!can({ type: 'cure', color, cards })}
              onClick={() => send({ type: 'cure', color, cards })}
            >
              {t('actions.cure', { color: t(`color.${color}`) })}
            </Button>
          );
        })}
      </div>

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
