import type { EventModule } from './types';

/**
 * One Quiet Night: the next infect step that starts is skipped (`turn.ts`). Played during an
 * infect step, that is the next turn's; epidemics still infect.
 */
export const oneQuietNight: EventModule = {
  id: 'one-quiet-night',
  check: () => ({ ok: true }),
  apply(state) {
    state.quietNight = true;
  },
};
