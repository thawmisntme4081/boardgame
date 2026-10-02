import {
  canSpendReroll,
  canUseAbilityInView,
  coffeeRange,
  dicePerRound,
  diceToPlace,
  landingConditions,
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
import { useTranslation } from 'react-i18next';
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
import { t as translate } from '@/i18n';
import { formatClock } from '@/lib/clock';
import { useNow } from '@/lib/useNow';
import { cn } from '@/lib/utils';
import { seatName } from '@/messages';
import { abilityText } from '@/scenarioText';
import { useGame } from '@/store';
import { DieFace } from '@/svgs/DieFace';

const partnerName = (view: PlayerView, presence: Presence | null) =>
  presence?.[otherSeat(view.seat)]?.name ?? seatName(otherSeat(view.seat));

/** The Special Ability cards in play; tap one for its rule (no hover-only info on phones). */
function AbilityList({ view }: { view: PlayerView }) {
  const { t } = useTranslation();
  if (view.abilities.length === 0) return null;
  return (
    <p className="text-xs text-muted-foreground">
      {t('tray.abilities')}{' '}
      {view.abilities.map((ability, i) => (
        <span key={ability}>
          {i > 0 && ' · '}
          <Popover>
            <PopoverTrigger className="relative font-medium text-foreground underline decoration-dotted underline-offset-2 outline-none after:absolute after:top-1/2 after:left-1/2 after:h-11 after:w-full after:min-w-11 after:-translate-1/2 focus-visible:ring-3 focus-visible:ring-ring/50">
              {abilityText(ability).name}
            </PopoverTrigger>
            <PopoverContent side="top" className="w-64">
              <PopoverHeader>
                <PopoverTitle>{abilityText(ability).name}</PopoverTitle>
                <PopoverDescription>{abilityText(ability).rule}</PopoverDescription>
              </PopoverHeader>
            </PopoverContent>
          </Popover>
        </span>
      ))}
    </p>
  );
}

/**
 * From the round before the final one: what a landing needs (tap for the list). The list
 * comes from the shared rules, so modules add their own conditions.
 */
function WinConditions({ view, className }: { view: PlayerView; className?: string }) {
  const { t } = useTranslation();
  if (view.round < view.scenario.altitudes.length - 1) return null;
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          'relative self-center font-medium text-foreground underline decoration-dotted underline-offset-2 outline-none after:absolute after:top-1/2 after:left-1/2 after:h-11 after:w-full after:min-w-11 after:-translate-1/2 focus-visible:ring-3 focus-visible:ring-ring/50',
          className,
        )}
      >
        {t('tray.winConditions')}
      </PopoverTrigger>
      <PopoverContent side="top" className="w-64">
        <PopoverHeader>
          <PopoverTitle>{t('tray.winConditions')}</PopoverTitle>
          <PopoverDescription>{t('tray.winConditionsIntro')}</PopoverDescription>
        </PopoverHeader>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {landingConditions(view.scenario).map((reason) => (
            <li key={reason}>{t(`win.${reason}`)}</li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

const spacesAhead = (view: PlayerView, space: number) => {
  const ahead = space - view.approachIndex;
  if (space === view.approachPlanes.length - 1) return translate('tray.onAirport');
  if (ahead === 0) return translate('tray.onYourSpace');
  return translate('tray.spacesAhead', { count: ahead });
};

/** The traffic die rolled at the start of the round, and where each plane went. */
function TrafficNews({ view }: { view: PlayerView }) {
  const { t } = useTranslation();
  if (view.traffic.length === 0) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2" role="status">
      <span className="flex gap-1">
        {view.traffic.map(({ roll }, i) => (
          <DieFace key={i} value={roll} seat="pilot" kind="traffic" className="size-8" />
        ))}
      </span>
      <p className="text-sm">
        <span className="font-medium">{t('tray.traffic')}</span>{' '}
        {view.traffic
          .map(({ roll, space }) =>
            space === null
              ? t('tray.trafficNoPlanes', { roll })
              : t('tray.trafficRolled', { roll, where: spacesAhead(view, space) }),
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
  const { t } = useTranslation();
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
      {isReady ? t('tray.waitingFor', { name: partnerName }) : t('tray.rollDice')}
    </Button>
  );
}

function StrategyTray({ view, presence }: { view: PlayerView; presence: Presence | null }) {
  const { t } = useTranslation();
  return (
    // Notes on the left, "Roll dice" on the right (one column in the tablet side column).
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 tablet:grid-cols-1 desktop:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex min-w-0 flex-col gap-1">
        <TrafficNews view={view} />
        {view.scenario.modules.includes('real-time') ? (
          <p className="text-sm font-medium">
            {t('tray.realTime', { time: formatClock(REAL_TIME_MS) })}
          </p>
        ) : (
          view.timerMs !== null && (
            <p className="text-sm font-medium">
              {t('tray.timedGame', { time: formatClock(view.timerMs) })}
            </p>
          )
        )}
        <AbilityList view={view} />
        <WinConditions view={view} className="text-base" />
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
  const { t } = useTranslation();
  return (
    // Same two columns as the placing tray: text and dice left, the two buttons stacked right.
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 tablet:grid-cols-1 desktop:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-sm font-medium">{t('tray.rerollIntro')}</p>
        <div className="flex flex-wrap gap-2">
          {view.myDice.map((die) => (
            <button
              key={die.id}
              type="button"
              aria-pressed={pick.includes(die.id)}
              aria-label={
                pick.includes(die.id)
                  ? t('tray.rerollDieChosen', { value: die.value })
                  : t('tray.rerollDie', { value: die.value })
              }
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

function CoffeeControl({ view, value }: { view: PlayerView; value: DieValue }) {
  const delta = useGame((s) => s.coffeeDelta);
  const setDelta = useGame((s) => s.setCoffeeDelta);
  const { t } = useTranslation();
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
  const { t } = useTranslation();
  const buttons: { ability: ActionAbility; label: string; icon: ReactNode }[] = [
    {
      ability: 'adaptation',
      label: t('tray.flipTo', { value: 7 - value }),
      icon: <FlipVertical2 />,
    },
    { ability: 'anticipation', label: t('tray.rerollThisDie'), icon: <RotateCcw /> },
    {
      ability: 'working-together',
      label: view.swap ? t('tray.swapFor', { value: view.swap.value }) : t('tray.offerSwap'),
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
          className="h-auto min-h-11 max-w-full text-left whitespace-normal"
          title={abilityText(ability).rule}
          onClick={() => void playAbility({ ability, dieId })}
        >
          {icon} {label}
          <span className="sr-only"> ({abilityText(ability).name})</span>
        </Button>
      ))}
    </div>
  );
}

function placingText(view: PlayerView, partner: string, placingToken: boolean): string {
  if (view.swap) {
    return view.swap.seat === view.seat
      ? translate('tray.swapWaiting', { name: partner, value: view.swap.value })
      : translate('tray.swapOffered', { name: partner, value: view.swap.value });
  }
  if (view.bonus) {
    return view.seat === 'copilot'
      ? translate('tray.syncPlace')
      : translate('tray.syncPartner', { name: partner });
  }
  if (placingToken) {
    return translate('tray.internToken', { value: nextInternToken(view.intern, view.seat) });
  }
  if (view.currentSeat !== view.seat) {
    const partnerSeat = otherSeat(view.seat);
    const count = diceToPlace(view.placed, view.scenario, partnerSeat, view.partnerDiceLeft);
    const options = { name: partner, count };
    return view.rerollPending[otherSeat(view.seat)]
      ? translate('tray.partnerPlacingRerolling', options)
      : translate('tray.partnerPlacing', options);
  }
  if (view.myDice.length === 0) return translate('tray.allPlaced');
  // Engines out: the dice beyond the round's limit stay in the tray, unused.
  if (diceToPlace(view.placed, view.scenario, view.seat, view.myDice.length) === 0) {
    return translate('tray.diceDone', { count: dicePerRound(view.scenario) });
  }
  return translate('tray.yourTurn');
}

function PlacingTray({ view, presence }: { view: PlayerView; presence: Presence | null }) {
  const selectedDieId = useGame((s) => s.selectedDieId);
  const coffeeDelta = useGame((s) => s.coffeeDelta);
  const selectDie = useGame((s) => s.selectDie);
  const internSlot = useGame((s) => s.internSlot);
  const setInternSlot = useGame((s) => s.setInternSlot);
  const { t } = useTranslation();
  const myTurn = view.currentSeat === view.seat;
  const partner = partnerName(view, presence);
  const selected = view.myDice.find((d) => d.id === selectedDieId);
  const canSpend = canSpendReroll(view).ok;
  // Synchronization: the co-pilot holds the black traffic die until it is placed.
  const trafficDie = view.seat === 'copilot' ? view.bonus?.die : undefined;
  // Training the intern: the token the die on the Intern space collects, waiting for a space.
  const internToken = internSlot ? nextInternToken(view.intern, view.seat) : undefined;
  // Engines out: once a player has placed their 3 dice, the 4th is a spare.
  const spare = diceToPlace(view.placed, view.scenario, view.seat, view.myDice.length) === 0;

  return (
    // Two columns (one in the narrow tablet side column): status and dice on the left;
    // coffee, reroll, ability buttons and the abilities list on the right.
    <div className="grid grid-cols-[minmax(13.5rem,1fr)_minmax(0,auto)] items-start gap-x-3 gap-y-2 tablet:grid-cols-1 desktop:grid-cols-[minmax(0,1fr)_auto]">
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
          {internToken !== undefined && (
            <span
              role="img"
              aria-label={t('tray.internTokenHeld', { value: internToken })}
              className="-translate-y-1 rounded-xl p-0.5 ring-4 ring-foreground"
            >
              <DieFace value={internToken} seat={view.seat} kind="intern" className="size-11" />
            </span>
          )}
          {trafficDie && (
            <button
              type="button"
              aria-pressed={trafficDie.id === selectedDieId}
              aria-label={t('tray.trafficDie', { value: trafficDie.value })}
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
                aria-label={t('tray.yourDie', { value: shown })}
                disabled={spare}
                onClick={() => selectDie(die.id)}
                className={cn(
                  'rounded-xl p-0.5 transition',
                  spare && 'opacity-40',
                  // Once on the Intern space, the die steps back for the token it collected.
                  isSelected &&
                    (internSlot ? 'opacity-40' : '-translate-y-1 ring-4 ring-foreground'),
                )}
              >
                <DieFace value={shown} seat={view.seat} className="size-11" />
              </button>
            );
          })}
          {view.myDice.length === 0 && !trafficDie && (
            <span className="text-sm text-muted-foreground">{t('tray.noDiceLeft')}</span>
          )}
        </div>
      </div>
      <div className="flex min-w-0 flex-col items-end gap-2 tablet:items-start desktop:items-end">
        {selected && !internSlot && <CoffeeControl view={view} value={selected.value} />}
        {selected && !internSlot && (
          <AbilityActions view={view} dieId={selected.id} value={selected.value} />
        )}
        {internSlot && (
          <Button variant="outline" className="h-11" onClick={() => setInternSlot(null)}>
            <X /> {t('tray.cancelIntern')}
          </Button>
        )}
        {canSpend && (
          <Button
            variant="outline"
            className="h-11"
            aria-label={t('tray.spendReroll', { count: view.rerolls })}
            onClick={() => void spendReroll()}
          >
            <RotateCcw /> {t('tray.rerollToken', { count: view.rerolls })}
          </Button>
        )}
        <AbilityList view={view} />
        <WinConditions view={view} className="text-sm" />
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
