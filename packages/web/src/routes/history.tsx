// `/history`: the account's Flight Log.
import { createFileRoute } from '@tanstack/react-router';
import { History } from '../screens/History';

export const Route = createFileRoute('/history')({ component: History });
