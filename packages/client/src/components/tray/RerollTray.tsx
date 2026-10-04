import type { PlayerView } from '@sky/shared';
import { RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { reroll } from '@/api';
import { Button } from '@/components/ui/button';
import { useGame } from '@/store';
import { DieButton } from './DieButton';

/** A reroll token was spent: tick the dice to roll again, or keep them all. */
export function RerollTray({ view }: { view: PlayerView }) {
  const pick = useGame((s) => s.rerollPick);
  const toggle = useGame((s) => s.toggleRerollPick);
  const { t } = useTranslation();
  return (
    // Same two columns as the placing tray: text and dice left, the two buttons stacked right.
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 tablet:grid-cols-1 desktop:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-sm font-medium">{t('tray.rerollIntro')}</p>
        <div className="flex flex-wrap gap-2">
          {view.myDice.map((die) => {
            const picked = pick.includes(die.id);
            return (
              <DieButton
                key={die.id}
                value={die.value}
                seat={view.seat}
                pressed={picked}
                label={
                  picked
                    ? t('tray.rerollDieChosen', { value: die.value })
                    : t('tray.rerollDie', { value: die.value })
                }
                onClick={() => toggle(die.id)}
                className={picked ? 'opacity-50 ring-4 ring-foreground' : 'opacity-100'}
              />
            );
          })}
        </div>
      </div>
      <div className="flex flex-col items-stretch gap-2">
        <Button className="h-11" disabled={pick.length === 0} onClick={() => void reroll(pick)}>
          <RotateCcw />{' '}
          {pick.length > 0 ? t('tray.rerollButton', { count: pick.length }) : t('tray.rerollNone')}
        </Button>
        <Button variant="outline" className="h-11" onClick={() => void reroll([])}>
          {t('tray.keepAll')}
        </Button>
      </div>
    </div>
  );
}
