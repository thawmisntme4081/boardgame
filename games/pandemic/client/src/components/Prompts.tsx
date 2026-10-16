import {
  canActInView,
  canCarryOnAccept,
  offeredPawn,
  pawnOwner,
  shareAnswerer,
  type PandemicView,
} from '@pandemic/rules';
import { Button } from '@platform/ui/components/button';
import type { SeatPresence } from '@platform/ui/game';
import { useTranslation } from 'react-i18next';
import { cityName, pawnName, seatName } from '../lib/names';
import { platform } from '../platform';
import { carryPart, usePandemic } from '../store';
import { CarryPicker } from './CarryPicker';

/**
 * Questions that stop play: a Share Knowledge or move offer to answer, or a Forecast being
 * arranged. (A card to discard is asked in the action bar.)
 */
export function Prompts({ view, presence }: { view: PandemicView; presence: SeatPresence | null }) {
  const { t } = useTranslation('pandemic');
  const carry = usePandemic((s) => s.carry);
  const { pending, you } = view;
  // A card to discard is asked in the action bar, not here.
  if (!pending || pending.kind === 'discard' || view.status !== 'playing') return null;

  if (pending.kind === 'move') {
    const moved = offeredPawn(view, pending.by, pending.move);
    // A pawn taken along by another (Relocation Specialist), rather than moved itself.
    const along = pending.move.carry?.pawn === pending.pawn;
    const cubes = pending.move.carry?.cubes.length ?? 0;
    const answering = you === pawnOwner(pending.pawn);
    // The moved pawn's owner chooses what it takes along when accepting (Relocation Specialist).
    const choosing = answering && canCarryOnAccept(view);
    return (
      <section
        aria-labelledby="move-prompt-title"
        className="flex flex-col gap-2 rounded-lg border p-3"
      >
        <h2 id="move-prompt-title" className="font-semibold">
          {t('moveOffer.title')}
        </h2>
        <p className="text-sm">
          {along
            ? t('moveOffer.takeAlong', {
                carrier: pawnName(presence, moved),
                pawn: pawnName(presence, pending.pawn),
                city: cityName(pending.move.to),
              })
            : t('moveOffer.offered', {
                by: seatName(presence, pending.by),
                pawn: pawnName(presence, pending.pawn),
                city: cityName(pending.move.to),
              })}
          {cubes > 0 && <> {t('moveOffer.cubes', { count: cubes })}</>}
        </p>
        {choosing && (
          <CarryPicker view={view} pawn={moved} presence={presence} hint={t('carry.hintAccept')} />
        )}
        <div className="flex gap-2">
          {answering && (
            <>
              <Button
                onClick={() =>
                  void platform().send({
                    type: 'move-accept',
                    ...(choosing ? carryPart(carry) : {}),
                  })
                }
              >
                {t('moveOffer.accept')}
              </Button>
              <Button
                variant="outline"
                onClick={() => void platform().send({ type: 'move-decline' })}
              >
                {t('moveOffer.decline')}
              </Button>
            </>
          )}
          {you === pending.by && (
            <Button variant="outline" onClick={() => void platform().send({ type: 'move-cancel' })}>
              {t('moveOffer.cancel')}
            </Button>
          )}
        </div>
      </section>
    );
  }

  if (pending.kind === 'cure') {
    const cards = (pending.move.help ?? [])
      .map(({ seat, city }) =>
        t('actions.cureHelpCard', { city: cityName(city), name: seatName(presence, seat) }),
      )
      .join(', ');
    return (
      <section
        aria-labelledby="cure-prompt-title"
        className="flex flex-col gap-2 rounded-lg border p-3"
      >
        <h2 id="cure-prompt-title" className="font-semibold">
          {t('cureOffer.title')}
        </h2>
        <p className="text-sm">
          {t('cureOffer.offered', {
            by: seatName(presence, pending.by),
            cards,
            color: t(`color.${pending.move.color}`),
          })}{' '}
          {t('cureOffer.waiting', {
            names: pending.waiting.map((seat) => seatName(presence, seat)).join(', '),
          })}
        </p>
        <div className="flex gap-2">
          {you && pending.waiting.includes(you) && (
            <>
              <Button onClick={() => void platform().send({ type: 'cure-accept' })}>
                {t('cureOffer.accept')}
              </Button>
              <Button
                variant="outline"
                onClick={() => void platform().send({ type: 'cure-decline' })}
              >
                {t('cureOffer.decline')}
              </Button>
            </>
          )}
          {you === pending.by && (
            <Button variant="outline" onClick={() => void platform().send({ type: 'cure-cancel' })}>
              {t('cureOffer.cancel')}
            </Button>
          )}
        </div>
      </section>
    );
  }

  if (pending.kind === 'forecast') {
    // The player arranging them has the dialog (`ForecastDialog`); the others get no cards.
    return (
      <section
        aria-labelledby="forecast-prompt-title"
        className="flex flex-col gap-2 rounded-lg border p-3"
      >
        <h2 id="forecast-prompt-title" className="font-semibold">
          {t('forecast.title')}
        </h2>
        <p className="text-sm">
          {t('forecast.waiting', { name: seatName(presence, pending.seat), count: pending.count })}
        </p>
      </section>
    );
  }

  const answerer = shareAnswerer(view);
  return (
    <section
      aria-labelledby="share-prompt-title"
      className="flex flex-col gap-2 rounded-lg border p-3"
    >
      <h2 id="share-prompt-title" className="font-semibold">
        {t('share.title')}
      </h2>
      <p className="text-sm">
        {t('share.offered', {
          from: seatName(presence, pending.from),
          to: seatName(presence, pending.to),
          city: cityName(pending.city),
        })}
      </p>
      <div className="flex gap-2">
        {you && you === answerer && (
          <>
            <Button onClick={() => void platform().send({ type: 'share-accept' })}>
              {t('share.accept')}
            </Button>
            <Button
              variant="outline"
              onClick={() => void platform().send({ type: 'share-decline' })}
            >
              {t('share.decline')}
            </Button>
          </>
        )}
        {you && canActInView(view, you, { type: 'share-cancel' }) && (
          <Button variant="outline" onClick={() => void platform().send({ type: 'share-cancel' })}>
            {t('share.cancel')}
          </Button>
        )}
      </div>
    </section>
  );
}
