import {
  canCancelSwapInView,
  canSpendReroll,
  diceToPlace,
  nextInternToken,
  type DieValue,
  type PlayerView,
  type Presence,
} from '@sky/rules';
import { RotateCcw, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cancelSwap, spendReroll } from '../../api';
import { Button } from '@platform/ui/components/button';
import { SEAT_STYLE } from '../../lib/seatStyle';
import { cn } from '@platform/ui/utils';
import { partnerOf } from '../../partner';
import { useSkyTeam } from '../../store';
import { DieFace } from '../../svgs/DieFace';
import { AbilityActions } from './AbilityActions';
import { CoffeeControl } from './CoffeeControl';
import { DieButton, SELECTED_DIE } from './DieButton';
import { SetAsideDice, WeatherNote } from './notes';
import { AbilityList, WinConditions } from './popovers';
import { placingText } from './text';

interface RollCounts {
  /** Whether the last view had a Working Together offer waiting. */
  swap: boolean;
  /** Per die id: its last value, and how many times it rolled since it appeared. */
  dice: Record<string, { value: DieValue; rolls: number }>;
}

function nextRollCounts(seen: RollCounts, view: PlayerView): RollCounts {
  // The offer was answered: the values that changed were swapped, not rolled.
  const swapped = seen.swap && view.swap === null;
  const dice: RollCounts['dice'] = {};
  for (const { id, value } of view.myDice) {
    const was = seen.dice[id];
    const rolled = was !== undefined && was.value !== value && !swapped;
    dice[id] = { value, rolls: (was?.rolls ?? 0) + (rolled ? 1 : 0) };
  }
  return { swap: view.swap !== null, dice };
}

/**
 * A key per die that changes when the die is rolled again (a reroll, Turbulence, Adaptation),
 * so its face rolls; a Working Together swap changes the value without rolling it.
 */
function useRollKeys(view: PlayerView): (id: string) => string {
  const [seen, setSeen] = useState<RollCounts>(() =>
    nextRollCounts({ swap: false, dice: {} }, view),
  );
  const next = nextRollCounts(seen, view);
  // Adjusting state while rendering, when the view changed (React's pattern for derived state).
  if (JSON.stringify(next) !== JSON.stringify(seen)) setSeen(next);
  return (id) => `${id}:${next.dice[id]?.rolls ?? 0}`;
}

/** What you hold: the Intern token or traffic die in play, your dice, and dice set aside. */
function PlacingDice({ view }: { view: PlayerView }) {
  const selectedDieId = useSkyTeam((s) => s.selectedDieId);
  const coffeeDelta = useSkyTeam((s) => s.coffeeDelta);
  const selectDie = useSkyTeam((s) => s.selectDie);
  const internSlot = useSkyTeam((s) => s.internSlot);
  const { t } = useTranslation('sky-team');
  const rollKey = useRollKeys(view);
  // Synchronization: the co-pilot holds the black traffic die until it is placed.
  const trafficDie = view.seat === 'copilot' ? view.bonus?.die : undefined;
  // Training the intern: the token the die on the Intern space collects, waiting for a space.
  const internToken = internSlot ? nextInternToken(view.intern, view.seat) : undefined;
  // Engines out: once a player has placed their 3 dice, the 4th is a spare.
  const spare = diceToPlace(view.placed, view.scenario, view.seat, view.myDice.length) === 0;
  const setAside = view.setAside[view.seat];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {internToken !== undefined && (
        <span
          role="img"
          aria-label={t('tray.internTokenHeld', { value: internToken })}
          className={cn('rounded-xl p-0.5', SELECTED_DIE)}
        >
          <DieFace value={internToken} seat={view.seat} kind="intern" className="size-11" />
        </span>
      )}
      {trafficDie && (
        <DieButton
          value={trafficDie.value}
          seat="copilot"
          kind="traffic"
          pressed={trafficDie.id === selectedDieId}
          label={t('tray.trafficDie', { value: trafficDie.value })}
          onClick={() => selectDie(trafficDie.id)}
          className={cn(trafficDie.id === selectedDieId && SELECTED_DIE)}
        />
      )}
      {view.myDice.map((die) => {
        const isSelected = die.id === selectedDieId;
        const shown = (isSelected ? die.value + coffeeDelta : die.value) as DieValue;
        return (
          <DieButton
            // A die rolled again gets a new key, so its face rolls; coffee and a swap do not.
            key={rollKey(die.id)}
            value={shown}
            seat={view.seat}
            pressed={isSelected}
            animate={view.rerollBy === null || view.rerolledDice.includes(die.id)}
            label={t('tray.yourDie', { value: shown })}
            disabled={spare}
            onClick={() => selectDie(die.id)}
            className={cn(
              spare && 'opacity-40',
              // Once on the Intern space, the die steps back for the token it collected.
              isSelected && (internSlot ? 'opacity-40' : SELECTED_DIE),
            )}
          />
        );
      })}
      <SetAsideDice count={setAside} />
      {view.myDice.length === 0 && !trafficDie && setAside === 0 && (
        <span className="text-sm text-muted-foreground">{t('tray.noDiceLeft')}</span>
      )}
    </div>
  );
}

/** The buttons for the die in hand (coffee, abilities), cancelling the intern, the reroll token. */
function PlacingActions({ view }: { view: PlayerView }) {
  const selectedDieId = useSkyTeam((s) => s.selectedDieId);
  const internSlot = useSkyTeam((s) => s.internSlot);
  const setInternSlot = useSkyTeam((s) => s.setInternSlot);
  const { t } = useTranslation('sky-team');
  const selected = internSlot ? undefined : view.myDice.find((d) => d.id === selectedDieId);
  return (
    <div className="flex min-w-0 flex-col items-end gap-2 text-end">
      {selected && <CoffeeControl view={view} value={selected.value} />}
      {selected && <AbilityActions view={view} dieId={selected.id} value={selected.value} />}
      {canCancelSwapInView(view).ok && (
        <Button variant="outline" className="h-11" onClick={() => void cancelSwap()}>
          <X /> {t('tray.cancelSwap')}
        </Button>
      )}
      {internSlot && (
        <Button variant="outline" className="h-11" onClick={() => setInternSlot(null)}>
          <X /> {t('tray.cancelIntern')}
        </Button>
      )}
      {canSpendReroll(view).ok && (
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
  );
}

/** Dice are rolled: whose turn it is, your dice, and what you can do with the one in hand. */
export function PlacingTray({ view, presence }: { view: PlayerView; presence: Presence | null }) {
  const internSlot = useSkyTeam((s) => s.internSlot);
  const myTurn = view.currentSeat === view.seat;
  return (
    <div className="grid grid-cols-[minmax(13.5rem,1fr)_minmax(0,auto)] items-start gap-x-3 gap-y-2 tablet:grid-cols-1 desktop:flex desktop:justify-between">
      <div className="contents desktop:flex desktop:min-w-0 desktop:flex-col desktop:gap-2">
        <div className="col-span-2 flex min-w-0 flex-col gap-2 tablet:col-span-1">
          <p
            className={cn('text-sm font-medium', myTurn && SEAT_STYLE[view.seat].text)}
            role="status"
          >
            {placingText(view, partnerOf(view, presence).name, internSlot !== null)}
          </p>
          <WeatherNote view={view} />
        </div>
        <PlacingDice view={view} />
      </div>
      <PlacingActions view={view} />
    </div>
  );
}
