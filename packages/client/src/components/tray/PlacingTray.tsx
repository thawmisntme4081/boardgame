import {
  canSpendReroll,
  diceToPlace,
  nextInternToken,
  type DieValue,
  type PlayerView,
  type Presence,
} from '@sky/shared';
import { RotateCcw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { spendReroll } from '@/api';
import { Button } from '@/components/ui/button';
import { SEAT_STYLE } from '@/lib/seatStyle';
import { cn } from '@/lib/utils';
import { partnerOf } from '@/partner';
import { useGame } from '@/store';
import { DieFace } from '@/svgs/DieFace';
import { AbilityActions } from './AbilityActions';
import { CoffeeControl } from './CoffeeControl';
import { DieButton, SELECTED_DIE } from './DieButton';
import { SetAsideDice, WeatherNote } from './notes';
import { AbilityList, WinConditions } from './popovers';
import { placingText } from './text';

/** What you hold: the Intern token or traffic die in play, your dice, and dice set aside. */
function PlacingDice({ view }: { view: PlayerView }) {
  const selectedDieId = useGame((s) => s.selectedDieId);
  const coffeeDelta = useGame((s) => s.coffeeDelta);
  const selectDie = useGame((s) => s.selectDie);
  const internSlot = useGame((s) => s.internSlot);
  const { t } = useTranslation();
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
            key={die.id}
            value={shown}
            seat={view.seat}
            pressed={isSelected}
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
  const selectedDieId = useGame((s) => s.selectedDieId);
  const internSlot = useGame((s) => s.internSlot);
  const setInternSlot = useGame((s) => s.setInternSlot);
  const { t } = useTranslation();
  const selected = internSlot ? undefined : view.myDice.find((d) => d.id === selectedDieId);
  return (
    <div className="flex min-w-0 flex-col items-end gap-2 tablet:items-start desktop:items-end">
      {selected && <CoffeeControl view={view} value={selected.value} />}
      {selected && <AbilityActions view={view} dieId={selected.id} value={selected.value} />}
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
  const internSlot = useGame((s) => s.internSlot);
  const myTurn = view.currentSeat === view.seat;
  return (
    // Two columns (one in the narrow tablet side column): status and dice on the left;
    // coffee, reroll, ability buttons and the abilities list on the right.
    <div className="grid grid-cols-[minmax(13.5rem,1fr)_minmax(0,auto)] items-start gap-x-3 gap-y-2 tablet:grid-cols-1 desktop:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex min-w-0 flex-col gap-2">
        <p
          className={cn('text-sm font-medium', myTurn && SEAT_STYLE[view.seat].text)}
          role="status"
        >
          {placingText(view, partnerOf(view, presence).name, internSlot !== null)}
        </p>
        <WeatherNote view={view} />
        <PlacingDice view={view} />
      </div>
      <PlacingActions view={view} />
    </div>
  );
}
