// Pandemic's client module: what the platform shell loads (lazily) to show a Pandemic room.
import type { TableView } from '@pandemic/rules';
import type { PandemicLobby, PandemicMove } from '@pandemic/rules/definition';
import type { GameClientModule } from '@platform/ui/game';
import { Board } from './Board';
import { locales, NS } from './i18n';
import { errorText } from './messages';
import { connectPlatform } from './platform';
import { DEFAULT_SETUP } from './setup';
import { SetupForm } from './SetupForm';
import { usePandemic } from './store';
import { WaitingInfo } from './WaitingInfo';

export const pandemicClient: GameClientModule<TableView, PandemicMove, PandemicLobby> = {
  id: NS,
  locales,
  defaultSetup: DEFAULT_SETUP,
  SetupForm,
  Board,
  WaitingInfo,
  connect: connectPlatform,
  onView: (view, before) => usePandemic.getState().onView(view, before),
  reset: () => usePandemic.getState().reset(),
  errorText,
};

export default pandemicClient;
