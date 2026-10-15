import {
  actingPawn,
  COLORS,
  MAX_STATIONS,
  canActInView,
  cardsToCure,
  cityOf,
  HAND_LIMIT,
  heldEvents,
  pawnsOf,
  pawnsOnMap,
  roleOf,
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
import { DISEASE_PALE_TEXT, diseasePale } from '../lib/colors';
import { EventControls } from './EventControls';
import { cityName, ownPawnLabel, pawnName, seatName } from '../lib/names';
import { platform } from '../platform';
import { usePandemic } from '../store';

const send = (move: PandemicMove) => void platform().send(move);

const selectClass = 'h-11 rounded-md border bg-background px-2 text-sm';
const alertClass = 'rounded-lg border border-yellow-400 bg-yellow-100 p-3 text-sm text-yellow-950';

const buildMove = (move: CityId | ''): PandemicMove => ({
  type: 'build',
  ...(move ? { move } : {}),
});

/** Every city card of `color` in the hand: the cards a cure could use. */
function colorCards(view: PandemicView, seat: SeatId, color: Color): CityId[] {
  const hand = view.hands[seat] ?? [];
  return hand
    .flatMap((card) => (card.kind === 'city' ? [card.city] : []))
    .filter((city) => cityOf(city).color === color);
}

/** The legal actions as plain buttons (`canActInView` decides which show); on someone else's turn, a wait note. */
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
  // A share with several possible partners: the group whose partner is being chosen.
  const [sharing, setSharing] = useState<string | null>(null);
  const movingPawn = usePandemic((s) => s.movingPawn);
  const setMovingPawn = usePandemic((s) => s.setMovingPawn);
  const { you, turn } = view;

  if (!you) return <p className="text-sm text-muted-foreground">{t('actions.spectator')}</p>;
  // Someone else's turn: only the event cards on the table can be played (their role card is highlighted).
  const mine = turn.seat === you;
  // A hand over the limit: its owner discards (by pressing a card), the others wait.
  const owing = view.pending?.kind === 'discard' ? view.pending.seat : null;
  const toDiscard = owing ? Math.max(1, (view.hands[owing]?.length ?? 0) - HAND_LIMIT) : 0;
  if (!mine && !owing && view.seats.every((seat) => heldEvents(view, seat).length === 0)) {
    return null;
  }
  const can = (move: PandemicMove) => canActInView(view, you, move);
  const stationsFull = view.stations.length >= MAX_STATIONS;
  const here = view.pawns[actingPawn(view, you)] as CityId;
  // A role that moves other pawns picks which one the map moves.
  const movesPawns = roleOf(view, you)?.movesPawns === true;
  // A Teacher with students chooses the pawn that does the turn's actions before the first one.
  const ownPawns = pawnsOf(view, you);
  const choosingPawn = mine && turn.step === 'actions' && turn.pawn === null;
  // Event cards in the discard pile a role may take (each once).
  const takes = [
    ...new Set(view.playerDiscard.flatMap((card) => (card.kind === 'event' ? [card.event] : []))),
  ].filter((event) => can({ type: 'take-event', event }));
  const canBuild =
    can(buildMove(moveStation)) || (stationsFull && view.stations.some((id) => can(buildMove(id))));

  // Each group of buttons is drawn only if it has one.
  const colorButtons = [
    ...COLORS.filter((color) => can({ type: 'treat', color })).map((color) => (
      <Button
        key={`treat-${color}`}
        className={`hover:brightness-95 ${DISEASE_PALE_TEXT}`}
        style={diseasePale(color)}
        onClick={() => send({ type: 'treat', color })}
      >
        {t('actions.treat', { color: t(`color.${color}`) })}
      </Button>
    )),
    ...COLORS.flatMap((color) => {
      const owned = colorCards(view, you, color);
      const needed = cardsToCure(view, you);
      // Which cards makes no difference to whether a cure is legal, only how many.
      const first = owned.slice(0, needed);
      if (!can({ type: 'cure', color, cards: first })) return [];
      return [
        <Button
          key={`cure-${color}`}
          variant="outline"
          onClick={() =>
            owned.length > needed
              ? setCuring({ color, picked: [] })
              : send({ type: 'cure', color, cards: first })
          }
        >
          {t('actions.cure', { color: t(`color.${color}`) })}
        </Button>,
      ];
    }),
  ];
  const partners = view.seats.filter((seat) => seat !== you);
  // Share Knowledge offers, grouped by direction and card: with one possible partner the button
  // names them ("Give Paris to Medic"); with several it asks which one after the click.
  const groups = new Map<string, { direction: 'give' | 'take'; city: CityId; seats: SeatId[] }>();
  const addOffer = (direction: 'give' | 'take', city: CityId, seat: SeatId) => {
    const offer = {
      type: 'share-offer',
      direction,
      with: seat,
      ...(city === here ? {} : { city }),
    } as const;
    if (!can(offer)) return;
    const key = `${direction}:${city}`;
    const group = groups.get(key) ?? { direction, city, seats: [] };
    group.seats.push(seat);
    groups.set(key, group);
  };
  for (const direction of ['give', 'take'] as const) {
    for (const seat of partners) addOffer(direction, here, seat);
  }
  // A role that gives any city card: its other cards too.
  for (const card of view.hands[you] ?? []) {
    if (card.kind !== 'city' || card.city === here) continue;
    for (const seat of partners) addOffer('give', card.city, seat);
  }
  const sendShare = (direction: 'give' | 'take', city: CityId, seat: SeatId) => {
    setSharing(null);
    send({
      type: 'share-offer',
      direction,
      with: seat,
      ...(city === here ? {} : { city }),
    });
  };
  const roleName = (seat: SeatId) => {
    const role = view.roles[seat];
    return role ? t(`roles.${role}.name`) : seatName(presence, seat);
  };
  const shareButtons = [
    ...[...groups.entries()].map(([key, { direction, city, seats }]) => {
      const names = { city: cityName(city) };
      const only = seats.length === 1 ? (seats[0] as SeatId) : null;
      return (
        <Button
          key={`share-${key}`}
          variant="outline"
          onClick={() =>
            only ? sendShare(direction, city, only) : setSharing(sharing === key ? null : key)
          }
        >
          {only
            ? t(direction === 'give' ? 'share.giveTo' : 'share.takeFrom', {
                ...names,
                role: roleName(only),
              })
            : t(direction === 'give' ? 'share.giveCard' : 'share.takeCard', names)}
        </Button>
      );
    }),
    ...takes.map((event) => (
      <Button
        key={`take-${event}`}
        variant="outline"
        onClick={() => send({ type: 'take-event', event })}
      >
        {t('actions.takeEvent', { event: t(`events.${event}`) })}
      </Button>
    )),
  ];
  const stepButtons = [
    can({ type: 'draw' }) && (
      <Button key="draw" onClick={() => send({ type: 'draw' })}>
        {t('actions.draw')}
      </Button>
    ),
    can({ type: 'epidemic' }) && (
      <Button key="epidemic" onClick={() => send({ type: 'epidemic' })}>
        {t('actions.epidemic', { step: t(`board.epidemicStep.${turn.epidemicStep}`) })}
      </Button>
    ),
    can({ type: 'infect' }) && (
      <Button key="infect" onClick={() => send({ type: 'infect' })}>
        {t('actions.infect')}
      </Button>
    ),
    can({ type: 'pass' }) && (
      <Button
        key="pass"
        className="bg-destructive text-white hover:bg-destructive/90"
        onClick={() => send({ type: 'pass' })}
      >
        {t('actions.pass')}
      </Button>
    ),
    can({ type: 'restart-turn' }) && (
      <Button key="restart" variant="outline" onClick={() => send({ type: 'restart-turn' })}>
        {t('actions.restart')}
      </Button>
    ),
  ].filter(Boolean);

  return (
    <section
      aria-labelledby="actions-title"
      role="alert"
      className={`${alertClass} flex flex-col gap-3`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="actions-title" className="font-semibold">
          {t('actions.title')}
        </h2>
        {mine && <span>{t('board.actionsLeft', { count: turn.actionsLeft })}</span>}
      </div>

      {owing && (
        <p className="font-medium">
          {owing === you
            ? t('actions.discard', { count: toDiscard })
            : t('actions.discardWaiting', { name: seatName(presence, owing), count: toDiscard })}
        </p>
      )}

      {mine && movesPawns && (
        <div
          role="group"
          aria-label={t('actions.movePawn')}
          className="flex flex-wrap items-center gap-2"
        >
          <span className="font-medium">{t('actions.movePawn')}</span>
          {pawnsOnMap(view).map((pawn) => {
            const on = (movingPawn ?? you) === pawn;
            return (
              <Button
                key={pawn}
                size="sm"
                variant={on ? 'default' : 'outline'}
                aria-pressed={on}
                onClick={() => setMovingPawn(pawn === you ? null : pawn)}
              >
                {pawn === you ? t('actions.ownPawn') : pawnName(presence, pawn)}
              </Button>
            );
          })}
        </div>
      )}

      {choosingPawn && (
        <div
          role="group"
          aria-label={t('actions.choosePawn')}
          className="flex flex-wrap items-center gap-2"
        >
          <span className="font-medium">{t('actions.choosePawn')}</span>
          {ownPawns.map((pawn) => (
            <Button
              key={pawn}
              size="sm"
              variant="outline"
              onClick={() => send({ type: 'choose-pawn', pawn })}
            >
              {t('actions.pawnAt', {
                pawn: ownPawnLabel(pawn),
                city: cityName(view.pawns[pawn] as CityId),
              })}
            </Button>
          ))}
        </div>
      )}
      {mine && ownPawns.length > 1 && turn.pawn !== null && (
        <p className="text-sm">
          {t('actions.pawnToday', {
            pawn: t('actions.pawnAt', {
              pawn: ownPawnLabel(turn.pawn),
              city: cityName(view.pawns[turn.pawn] as CityId),
            }),
          })}
        </p>
      )}
      {can({ type: 'create-student' }) && (
        <div>
          <Button variant="outline" onClick={() => send({ type: 'create-student' })}>
            {t('actions.createStudent')}
          </Button>
        </div>
      )}

      {canBuild && (
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
            disabled={!can(buildMove(moveStation))}
            onClick={() => send(buildMove(moveStation))}
          >
            {t('actions.build')}
          </Button>
        </div>
      )}

      {colorButtons.length > 0 && <div className="flex flex-wrap gap-2">{colorButtons}</div>}

      {curing && (
        <fieldset className="flex flex-col gap-2 rounded-md border p-2">
          <legend className="px-1 text-sm font-medium">
            {t('actions.cureChoose', {
              color: t(`color.${curing.color}`),
              count: cardsToCure(view, you),
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
            {t('actions.cureChosen', {
              chosen: curing.picked.length,
              count: cardsToCure(view, you),
            })}
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

      {shareButtons.length > 0 && <div className="flex flex-wrap gap-2">{shareButtons}</div>}
      {sharing && groups.get(sharing) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">
            {t(
              groups.get(sharing)!.direction === 'give' ? 'share.chooseGive' : 'share.chooseTake',
              {
                city: cityName(groups.get(sharing)!.city),
              },
            )}
          </span>
          {groups.get(sharing)!.seats.map((seat) => (
            <Button
              key={seat}
              size="sm"
              variant="outline"
              onClick={() => {
                const { direction, city } = groups.get(sharing)!;
                sendShare(direction, city, seat);
              }}
            >
              {roleName(seat)}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setSharing(null)}>
            {t('actions.cureCancel')}
          </Button>
        </div>
      )}

      <EventControls view={view} presence={presence} />

      {stepButtons.length > 0 && <div className="flex flex-wrap gap-2">{stepButtons}</div>}
    </section>
  );
}
