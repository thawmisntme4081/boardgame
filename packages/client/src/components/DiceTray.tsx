import {
  canSpendReroll,
  coffeeRange,
  otherSeat,
  type DieValue,
  type PlayerView,
  type Presence,
} from '@sky/shared';
import { Coffee, Minus, Plus, RotateCcw } from 'lucide-react';
import { reroll, spendReroll } from '@/api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { seatName } from '@/messages';
import { useGame } from '@/store';
import { DieFace } from '@/svgs/DieFace';

const partnerName = (view: PlayerView, presence: Presence | null) =>
  presence?.[otherSeat(view.seat)]?.name ?? seatName[otherSeat(view.seat)];

function StrategyTray() {
  return (
    <p className="text-sm">
      Talk strategy now, then press “Ready to roll”. Once the dice are rolled, no talking until the
      round ends.
    </p>
  );
}

function RerollTray({ view }: { view: PlayerView }) {
  const pick = useGame((s) => s.rerollPick);
  const toggle = useGame((s) => s.toggleRerollPick);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">Reroll: tick the dice to roll again (once).</p>
      <div className="flex gap-2">
        {view.myDice.map((die) => (
          <button
            key={die.id}
            type="button"
            aria-pressed={pick.includes(die.id)}
            aria-label={`Die ${die.value}${pick.includes(die.id) ? ', will reroll' : ''}`}
            onClick={() => toggle(die.id)}
            className={cn(
              'rounded-xl p-0.5 transition',
              pick.includes(die.id) ? 'opacity-50 ring-4 ring-foreground' : 'opacity-100',
            )}
          >
            <DieFace value={die.value} seat={view.seat} className="size-11" />
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button
          className="h-11 flex-1"
          disabled={pick.length === 0}
          onClick={() => void reroll(pick)}
        >
          <RotateCcw /> Reroll {pick.length || ''}
        </Button>
        <Button variant="outline" className="h-11 flex-1" onClick={() => void reroll([])}>
          Keep all
        </Button>
      </div>
    </div>
  );
}

function CoffeeControl({ view, value }: { view: PlayerView; value: DieValue }) {
  const delta = useGame((s) => s.coffeeDelta);
  const setDelta = useGame((s) => s.setCoffeeDelta);
  const { min, max } = coffeeRange(view.coffee, value);
  if (view.coffee === 0) return null;
  return (
    <div className="flex items-center gap-2" aria-label="Coffee">
      <Button
        variant="outline"
        size="icon"
        className="size-11"
        aria-label="Spend coffee: minus 1"
        disabled={delta <= min}
        onClick={() => setDelta(delta - 1)}
      >
        <Minus />
      </Button>
      <span className="flex min-w-16 items-center justify-center gap-1 text-sm tabular-nums">
        <Coffee className="size-4" aria-hidden="true" />
        {delta > 0 ? `+${delta}` : delta}
      </span>
      <Button
        variant="outline"
        size="icon"
        className="size-11"
        aria-label="Spend coffee: plus 1"
        disabled={delta >= max}
        onClick={() => setDelta(delta + 1)}
      >
        <Plus />
      </Button>
    </div>
  );
}

function PlacingTray({ view, presence }: { view: PlayerView; presence: Presence | null }) {
  const selectedDieId = useGame((s) => s.selectedDieId);
  const coffeeDelta = useGame((s) => s.coffeeDelta);
  const selectDie = useGame((s) => s.selectDie);
  const myTurn = view.currentSeat === view.seat;
  const partner = partnerName(view, presence);
  const selected = view.myDice.find((d) => d.id === selectedDieId);
  const canSpend = canSpendReroll(view).ok;

  return (
    <div className="flex flex-col gap-3">
      <p
        className={cn(
          'text-sm font-medium',
          myTurn && (view.seat === 'pilot' ? 'text-pilot' : 'text-copilot'),
        )}
        role="status"
      >
        {myTurn
          ? view.myDice.length > 0
            ? 'Your turn: tap a die, then a glowing space.'
            : 'Your dice are all placed.'
          : `${partner} is placing a die…`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {view.myDice.map((die) => {
          const isSelected = die.id === selectedDieId;
          const shown = (isSelected ? die.value + coffeeDelta : die.value) as DieValue;
          return (
            <button
              key={die.id}
              type="button"
              aria-pressed={isSelected}
              aria-label={`Your die: ${shown}`}
              onClick={() => selectDie(die.id)}
              className={cn(
                'rounded-xl p-0.5 transition',
                isSelected && '-translate-y-1 ring-4 ring-foreground',
              )}
            >
              <DieFace value={shown} seat={view.seat} className="size-11" />
            </button>
          );
        })}
        {view.myDice.length === 0 && (
          <span className="text-sm text-muted-foreground">No dice left</span>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {selected ? <CoffeeControl view={view} value={selected.value} /> : <span />}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span aria-label={`${partner} has ${view.partnerDiceLeft} dice left`}>
            {partner}: {view.partnerDiceLeft} {view.partnerDiceLeft === 1 ? 'die' : 'dice'}
            {view.rerollPending[otherSeat(view.seat)] && ' · rerolling'}
          </span>
          {canSpend && (
            <Button
              variant="outline"
              className="h-11"
              aria-label={`Spend a reroll token (${view.rerolls} left)`}
              onClick={() => void spendReroll()}
            >
              <RotateCcw /> Reroll ({view.rerolls})
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function DiceTray({ view, presence }: { view: PlayerView; presence: Presence | null }) {
  if (view.phase === 'strategy') return <StrategyTray />;
  if (view.phase !== 'placing') return null;
  if (view.rerollPending[view.seat]) return <RerollTray view={view} />;
  return <PlacingTray view={view} presence={presence} />;
}
