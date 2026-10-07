// Sky Team's client module: what the platform shell loads (lazily) to show a Sky Team room.
import type { GameClientModule } from '@platform/ui/game';
import type { GameSetup, PlayerMove, PlayerView, Presence } from '@sky/rules';
import { FlightLogHistory } from './components/FlightLog';
import { locales, NS } from './i18n';
import { DEFAULT_SETUP } from './lib/setup';
import { errorText } from './messages';
import { connectPlatform } from './platform';
import Board from './screens/Game';
import { SetupForm } from './SetupForm';
import { useSkyTeam } from './store';
import { WaitingInfo } from './WaitingInfo';

export const skyTeamClient: GameClientModule<PlayerView, PlayerMove, GameSetup> = {
  id: NS,
  locales,
  defaultSetup: { ...DEFAULT_SETUP, timer: false },
  SetupForm,
  // The platform's presence is the same data, typed for any seats; Sky Team's names them.
  Board: Board as GameClientModule<PlayerView, PlayerMove, GameSetup>['Board'],
  WaitingInfo,
  connect: connectPlatform,
  onView: (view, before, presence) =>
    useSkyTeam.getState().onView(view, before, presence as Presence | null),
  reset: () => useSkyTeam.getState().reset(),
  errorText,
  History: FlightLogHistory,
};

export default skyTeamClient;
