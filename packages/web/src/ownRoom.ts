import { redirect } from '@tanstack/react-router';
import { usePlatform } from './store';

/** A player with a seat always lands in their room (a reload, an old link, the back button). */
export function toOwnRoom(code?: string): void {
  const session = usePlatform.getState().session;
  if (session && session.code !== code?.toUpperCase()) {
    throw redirect({ to: '/r/$code', params: { code: session.code }, replace: true });
  }
}
