import { coffeeRange, type DieValue, type PlayerView } from '@sky/rules';
import { Coffee, Minus, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@platform/ui/components/button';
import { useSkyTeam } from '../../store';

/** − / + coffee for the selected die, within what the coffee in stock and the die allow. */
export function CoffeeControl({ view, value }: { view: PlayerView; value: DieValue }) {
  const delta = useSkyTeam((s) => s.coffeeDelta);
  const setDelta = useSkyTeam((s) => s.setCoffeeDelta);
  const { t } = useTranslation('sky-team');
  const { min, max } = coffeeRange(view.coffee, value);
  if (view.coffee === 0) return null;
  return (
    <div className="flex items-center gap-2" aria-label={t('tray.coffee')}>
      <Button
        variant="outline"
        size="icon"
        className="size-11"
        aria-label={t('tray.coffeeMinus')}
        disabled={delta <= min}
        onClick={() => setDelta(delta - 1)}
      >
        <Minus />
      </Button>
      <span className="flex min-w-10 items-center justify-center gap-1 text-sm tabular-nums">
        <Coffee className="size-4" aria-hidden="true" />
        {delta > 0 ? `+${delta}` : delta}
      </span>
      <Button
        variant="outline"
        size="icon"
        className="size-11"
        aria-label={t('tray.coffeePlus')}
        disabled={delta >= max}
        onClick={() => setDelta(delta + 1)}
      >
        <Plus />
      </Button>
    </div>
  );
}
