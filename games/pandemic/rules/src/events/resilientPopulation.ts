import type { EventModule } from './types';

/**
 * Resilient Population: a card of the infection discard pile leaves the game, so it can never
 * be drawn again. Also playable in an epidemic's pause, between its Infect and Intensify steps,
 * to keep the city just infected out of the reshuffled pile.
 */
export const resilientPopulation: EventModule = {
  id: 'resilient-population',
  inEpidemicPause: true,
  check(state, _seat, play) {
    if (play.event !== 'resilient-population') return { ok: false, reason: 'not-playable' };
    return state.infectionDiscard.includes(play.city)
      ? { ok: true }
      : { ok: false, reason: 'card-missing' };
  },
  apply(state, _seat, play) {
    if (play.event !== 'resilient-population') return;
    state.infectionDiscard.splice(state.infectionDiscard.indexOf(play.city), 1);
  },
};
