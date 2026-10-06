// The dice tray's sentences, built from the view (the shared rules count the dice).
import {
  dicePerRound,
  diceToPlace,
  nextInternToken,
  otherSeat,
  SLOTS,
  type PlayerView,
} from '@sky/shared';
import { t } from '@/i18n';

/** The placing tray's status line: what you (or your partner) are doing now. */
export function placingText(view: PlayerView, partner: string, placingToken: boolean): string {
  if (view.swap) {
    return view.swap.seat === view.seat
      ? t('tray.swapWaiting', { name: partner, value: view.swap.value })
      : t('tray.swapOffered', { name: partner, value: view.swap.value });
  }
  if (view.bonus) {
    return view.seat === 'copilot' ? t('tray.syncPlace') : t('tray.syncPartner', { name: partner });
  }
  if (placingToken) {
    return t('tray.internToken', { value: nextInternToken(view.intern, view.seat) });
  }
  if (view.currentSeat !== view.seat) {
    const partnerSeat = otherSeat(view.seat);
    const count = diceToPlace(view.placed, view.scenario, partnerSeat, view.partnerDiceLeft);
    const options = { name: partner, count };
    return view.rerollPending[partnerSeat]
      ? t('tray.partnerPlacingRerolling', options)
      : t('tray.partnerPlacing', options);
  }
  if (view.myDice.length === 0) return t('tray.allPlaced');
  // Engines out: the dice beyond the round's limit stay in the tray, unused.
  if (diceToPlace(view.placed, view.scenario, view.seat, view.myDice.length) === 0) {
    return t('tray.diceDone', { count: dicePerRound(view.scenario) });
  }
  // What the partner just did, so it is not missed; the first die of a round has nothing to say.
  const last = view.lastPlace;
  if (last && last.seat !== view.seat) {
    return t('tray.yourTurnAfter', {
      name: partner,
      value: last.value,
      slot: t(`slot.group.${SLOTS[last.slot].group}`),
    });
  }
  return t('tray.yourTurn');
}
