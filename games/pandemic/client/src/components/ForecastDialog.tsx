import type { CityId, PandemicView } from '@pandemic/rules';
import { Button } from '@platform/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@platform/ui/components/dialog';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { infectionCardUrl } from '../lib/cardImages';
import { moveItem } from '../lib/events';
import { cityName } from '../lib/names';
import { platform } from '../platform';

/**
 * Forecast, for the player who played it: the top infection cards, to put back in any order.
 * Drag a card, or use the arrows (the keyboard and touch way); the top of the list is the next
 * card to be flipped. The dialog cannot be closed: nothing else can happen until the order is
 * sent.
 */
function Arrange({ cards }: { cards: readonly CityId[] }) {
  const { t } = useTranslation('pandemic');
  const [order, setOrder] = useState([...cards]);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [sent, setSent] = useState(false);

  const drop = (to: number) => {
    if (dragging !== null) setOrder((list) => moveItem(list, dragging, to));
    setDragging(null);
    setOver(null);
  };

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t('forecast.title')}</DialogTitle>
          <DialogDescription>{t('forecast.hint')}</DialogDescription>
        </DialogHeader>
        <ol className="flex flex-col gap-2">
          {order.map((city, i) => (
            <li
              key={city}
              draggable
              onDragStart={() => setDragging(i)}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(i);
              }}
              onDrop={() => drop(i)}
              onDragEnd={() => {
                setDragging(null);
                setOver(null);
              }}
              className={`flex cursor-grab items-center gap-3 rounded-lg border p-2 ${
                over === i && dragging !== i ? 'border-primary bg-accent' : ''
              } ${dragging === i ? 'opacity-50' : ''}`}
            >
              <span className="w-12 text-xs font-medium text-muted-foreground">
                {i === 0 ? t('forecast.top') : i + 1}
              </span>
              <img
                src={infectionCardUrl(city)}
                alt=""
                draggable={false}
                className="h-12 w-auto rounded"
              />
              <span className="flex-1 font-medium">{cityName(city)}</span>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={t('forecast.up', { city: cityName(city) })}
                disabled={i === 0}
                onClick={() => setOrder((list) => moveItem(list, i, i - 1))}
              >
                <ArrowUp />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={t('forecast.down', { city: cityName(city) })}
                disabled={i === order.length - 1}
                onClick={() => setOrder((list) => moveItem(list, i, i + 1))}
              >
                <ArrowDown />
              </Button>
            </li>
          ))}
        </ol>
        <DialogFooter>
          <Button
            className="h-11"
            disabled={sent}
            onClick={() => {
              setSent(true);
              void platform().send({ type: 'forecast-order', cards: order });
            }}
          >
            {t('forecast.keep')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Opens for the player arranging a Forecast, and only for them (no other view holds the cards). */
export function ForecastDialog({ view }: { view: PandemicView }) {
  const { pending, you } = view;
  if (pending?.kind !== 'forecast' || pending.seat !== you || view.status !== 'playing') {
    return null;
  }
  return <Arrange key={pending.cards.join('|')} cards={pending.cards} />;
}
