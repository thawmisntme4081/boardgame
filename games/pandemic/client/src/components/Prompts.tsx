import { HAND_LIMIT, canActInView, shareAnswerer, type PandemicView } from '@pandemic/rules';
import { Button } from '@platform/ui/components/button';
import type { SeatPresence } from '@platform/ui/game';
import { useTranslation } from 'react-i18next';
import { useCardText } from '../lib/cards';
import { cityName, seatName } from '../lib/names';
import { platform } from '../platform';

/** Questions that stop play: a card to discard, or a Share Knowledge offer to answer. */
export function Prompts({ view, presence }: { view: PandemicView; presence: SeatPresence | null }) {
  const { t } = useTranslation('pandemic');
  const cardText = useCardText();
  const { pending, you } = view;
  if (!pending || view.status !== 'playing') return null;

  if (pending.kind === 'discard') {
    return (
      <section
        aria-labelledby="discard-title"
        className="flex flex-col gap-2 rounded-lg border p-3"
      >
        <h2 id="discard-title" className="font-semibold">
          {t('discard.title')}
        </h2>
        {pending.seat === you ? (
          <>
            <p className="text-sm">{t('discard.text', { limit: HAND_LIMIT })}</p>
            <div className="flex flex-wrap gap-2">
              {(view.hands[pending.seat] ?? []).map((card, i) => (
                <Button
                  key={i}
                  variant="outline"
                  onClick={() => void platform().send({ type: 'discard', card })}
                >
                  {t('discard.button', { card: cardText(card) })}
                </Button>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm">
            {t('discard.waiting', { name: seatName(presence, pending.seat) })}
          </p>
        )}
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
