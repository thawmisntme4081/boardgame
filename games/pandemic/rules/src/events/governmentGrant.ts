import { checkStationPlace, placeStation } from '../actions';
import type { EventModule } from './types';

/** Government Grant: a research station in any city, with no card; the 6-station rule of Build. */
export const governmentGrant: EventModule = {
  id: 'government-grant',
  check(state, _seat, play) {
    if (play.event !== 'government-grant') return { ok: false, reason: 'not-playable' };
    return checkStationPlace(state, play.city, play.move);
  },
  apply(state, _seat, play) {
    if (play.event === 'government-grant') placeStation(state, play.city, play.move);
  },
};
