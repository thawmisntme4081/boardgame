// `/`: the game picker.
import { createFileRoute } from '@tanstack/react-router';
import { toOwnRoom } from '../ownRoom';
import { Picker } from '../screens/Picker';

export const Route = createFileRoute('/')({
  beforeLoad: () => toOwnRoom(),
  component: Picker,
});
