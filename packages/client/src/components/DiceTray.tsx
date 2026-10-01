import {
  canSpendReroll,
  canUseAbilityInView,
  coffeeRange,
  nextInternToken,
  otherSeat,
  REAL_TIME_MS,
  type AbilityAction,
  type DieValue,
  type PlayerView,
  type Presence,
} from '@sky/shared';
import { ArrowLeftRight, Coffee, FlipVertical2, Minus, Plus, RotateCcw, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { playAbility, ready, reroll, spendReroll } from '@/api';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { formatClock } from '@/lib/clock';
import { useNow } from '@/lib/useNow';
import { cn } from '@/lib/utils';
import { seatName } from '@/messages';
import { ABILITY_TEXT } from '@/scenarioText';
import { useGame } from '@/store';
import { DieFace } from '@/svgs/DieFace';

const partnerName = (view: PlayerView, presence: Presence | null) =>
  presence?.[otherSeat(view.seat)]?.name ?? seatName[otherSeat(view.seat)];

/** The Special Ability cards in play; tap one for its rule (no hover-only info on phones). */
function AbilityList({ view }: { view: PlayerView }) {
  if (view.abilities.length === 0) return null;
  return (
    <p className="text-xs text-muted-foreground">
      Abilities:{' '}
      {view.abilities.map((ability, i) => (
        <span key={ability}>
          {i > 0 && ' · '}
          <Popover>
            <PopoverTrigger className="relative font-medium text-foreground underline decoration-dotted underline-offset-2 outline-none after:absolute after:top-1/2 after:left-1/2 after:h-11 after:w-full after:min-w-11 after:-translate-1/2 focus-visible:ring-3 focus-visible:ring-ring/50">
              {ABILITY_TEXT[ability].name}
            </PopoverTrigger>
            <PopoverContent side="top" className="w-64">
              <PopoverHeader>
                <PopoverTitle>{ABILITY_TEXT[ability].name}</PopoverTitle>
                <PopoverDescription>{ABILITY_TEXT[ability].rule}</PopoverDescription>
              </PopoverHeader>
            </PopoverContent>
          </Popover>
        </span>
      ))}
    </p>
  );
}

const spacesAhead = (view: PlayerView, space: number) => {
  const ahead = space - view.approachIndex;
  if (space === view.approachPlanes.length - 1) return 'on the airport';
  if (ahead === 0) return 'on your space';
  return `${ahead} ${ahead === 1 ? 'space' : 'spaces'} ahead`;
};

/** The traffic die rolled at the start of the round, and where each plane went. */
function TrafficNews({ view }: { view: PlayerView }) {
  if (view.traffic.length === 0) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2" role="status">
      <span className="flex gap-1">
        {view.traffic.map(({ roll }, i) => (
          <DieFace key={i} value={roll} seat="pilot" kind="traffic" className="size-8" />
        ))}
      </span>
      <p className="text-sm">
        <span className="font-medium">Traffic:</span>{' '}
        {view.traffic
          .map(({ roll, space }) =>
            space === null
              ? `rolled ${roll}, no planes left to add`
              : `rolled ${roll}, a plane ${spacesAhead(view, space)}`,
          )
          .join('; ')}
        .
      </p>
    </div>
  );
}

/**
 * Ends your strategy discussion; the dice roll once both players are ready. Disabled during
 * the green "Next turn in 5s" pause, so the finished round stays on screen for its 5 seconds.
 */
function ReadyButton({ ready: isReady, partnerName }: { ready: boolean; partnerName: string }) {
  const nextTurnAt = useGame((s) => s.nextTurnAt);
  const now = useNow();
  const pausing = nextTurnAt !== null && now < nextTurnAt;
  return (
    <Button
      className="h-11"
      variant={isReady ? 'outline' : 'default'}
      disabled={isReady || pausing}
      onClick={() => void ready()}
    >
      {isReady ? `Waiting for ${partnerName}…` : 'Roll dice'}
    </Button>
  );
}

function StrategyTray({ view, presence }: { view: PlayerView; presence: Presence | null }) {
  return (
    // Notes on the left, "Roll dice" on the right (one column in the tablet side column).
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 tablet:grid-cols-1 desktop:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex min-w-0 flex-col gap-1">
        <TrafficNews view={view} />
        {view.scenario.modules.includes('real-time') ? (
          <p className="text-sm font-medium">
            Real-time: {formatClock(REAL_TIME_MS)} to place the dice once you roll; dice not placed
            by then are lost.
          </p>
        ) : (
          view.timerMs !== null && (
            <p className="text-sm font-medium">
              Timed game: {formatClock(view.timerMs)} to place all the dice once you roll, or you
              lose.
            </p>
          )
        )}
        <AbilityList view={view} />
      </div>
      <ReadyButton
        ready={presence?.[view.seat]?.ready ?? false}
        partnerName={partnerName(view, presence)}
      />
    </div>
  );
}

function RerollTray({ view }: { view: PlayerView }) {
  const pick = useGame((s) => s.rerollPick);
  const toggle = useGame((s) => s.toggleRerollPick);
  return (
    // Same two columns as the placing tray: text and dice left, the two buttons stacked right.
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 tablet:grid-cols-1 desktop:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-sm font-medium">Reroll: tick the dice to roll again (once).</p>
        <div className="flex flex-wrap gap-2">
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
      </div>
      <div className="flex flex-col items-stretch gap-2">
        <Button className="h-11" disabled={pick.length === 0} onClick={() => void reroll(pick)}>
          <RotateCcw /> Reroll {pick.length || ''}
        </Button>
        <Button variant="outline" className="h-11" onClick={() => void reroll([])}>
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
      <span className="flex min-w-10 items-center justify-center gap-1 text-sm tabular-nums">
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

type ActionAbility = AbilityAction['ability'];

/** Adaptation, Anticipation and Working Together for the selected die, when the rules allow. */
function AbilityActions({
  view,
  dieId,
  value,
}: {
  view: PlayerView;
  dieId: string;
  value: DieValue;
}) {
  const buttons: { ability: ActionAbility; label: string; icon: ReactNode }[] = [
    { ability: 'adaptation', label: `Flip to ${7 - value}`, icon: <FlipVertical2 /> },
    { ability: 'anticipation', label: 'Reroll this die', icon: <RotateCcw /> },
    {
      ability: 'working-together',
      label: view.swap ? `Swap for the ${view.swap.value}` : 'Offer to swap',
      icon: <ArrowLeftRight />,
    },
  ];
  const usable = buttons.filter(({ ability }) => canUseAbilityInView(view, { ability, dieId }).ok);
  if (usable.length === 0) return null;
  return (
    <div className="flex flex-wrap justify-end gap-2 tablet:justify-start desktop:justify-end">
      {usable.map(({ ability, label, icon }) => (
        <Button
          key={ability}
          variant="outline"
          className="h-11"
          title={ABILITY_TEXT[ability].rule}
          onClick={() => void playAbility({ ability, dieId })}
        >
          {icon} {label}
          <span className="sr-only"> ({ABILITY_TEXT[ability].name})</span>
        </Button>
      ))}
    </div>
  );
}

function placingText(view: PlayerView, partner: string, placingToken: boolean): string {
  if (view.swap) {
    return view.swap.seat === view.seat
      ? `Working Together: waiting for ${partner} to swap with your ${view.swap.value}.`
      : `${partner} offers a ${view.swap.value} to swap: tap one of your dice, then Swap.`;
  }
  if (view.bonus) {
    return view.seat === 'copilot'
      ? 'Synchronisation: place the traffic die on any empty space.'
      : `${partner} is placing the traffic die…`;
  }
  if (placingToken) {
    return `Intern token ${nextInternToken(view.intern, view.seat)}: tap a glowing space for it.`;
  }
  if (view.currentSeat !== view.seat) {
    const left = view.partnerDiceLeft;
    const rerolling = view.rerollPending[otherSeat(view.seat)] ? ', rerolling' : '';
    return `${partner} is placing a die… (${left} ${left === 1 ? 'die' : 'dice'} left${rerolling})`;
  }
  return view.myDice.length > 0
    ? 'Your turn: tap a die, then a glowing space.'
    : 'Your dice are all placed.';
}

function PlacingTray({ view, presence }: { view: PlayerView; presence: Presence | null }) {
  const selectedDieId = useGame((s) => s.selectedDieId);
  const coffeeDelta = useGame((s) => s.coffeeDelta);
  const selectDie = useGame((s) => s.selectDie);
  const internSlot = useGame((s) => s.internSlot);
  const setInternSlot = useGame((s) => s.setInternSlot);
  const myTurn = view.currentSeat === view.seat;
  const partner = partnerName(view, presence);
  const selected = view.myDice.find((d) => d.id === selectedDieId);
  const canSpend = canSpendReroll(view).ok;
  // Synchronisation: the co-pilot holds the black traffic die until it is placed.
  const trafficDie = view.seat === 'copilot' ? view.bonus?.die : undefined;

  return (
    // Two columns (one in the narrow tablet side column): status and dice on the left;
    // coffee, reroll, ability buttons and the abilities list on the right.
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 tablet:grid-cols-1 desktop:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex min-w-0 flex-col gap-2">
        <p
          className={cn(
            'text-sm font-medium',
            myTurn && (view.seat === 'pilot' ? 'text-pilot' : 'text-copilot'),
          )}
          role="status"
        >
          {placingText(view, partner, internSlot !== null)}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {trafficDie && (
            <button
              type="button"
              aria-pressed={trafficDie.id === selectedDieId}
              aria-label={`Traffic die: ${trafficDie.value}`}
              onClick={() => selectDie(trafficDie.id)}
              className={cn(
                'rounded-xl p-0.5 transition',
                trafficDie.id === selectedDieId && '-translate-y-1 ring-4 ring-foreground',
              )}
            >
              <DieFace value={trafficDie.value} seat="copilot" kind="traffic" className="size-11" />
            </button>
          )}
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
          {view.myDice.length === 0 && !trafficDie && (
            <span className="text-sm text-muted-foreground">No dice left</span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-2 tablet:items-start desktop:items-end">
        {selected && !internSlot && <CoffeeControl view={view} value={selected.value} />}
        {selected && !internSlot && (
          <AbilityActions view={view} dieId={selected.id} value={selected.value} />
        )}
        {internSlot && (
          <Button variant="outline" className="h-11" onClick={() => setInternSlot(null)}>
            <X /> Cancel the intern
          </Button>
        )}
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
        <AbilityList view={view} />
      </div>
    </div>
  );
}

export function DiceTray({ view, presence }: { view: PlayerView; presence: Presence | null }) {
  if (view.phase === 'strategy') return <StrategyTray view={view} presence={presence} />;
  if (view.phase !== 'placing') return null;
  if (view.rerollPending[view.seat]) return <RerollTray view={view} />;
  return <PlacingTray view={view} presence={presence} />;
}
