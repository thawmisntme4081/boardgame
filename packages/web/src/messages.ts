import i18n from '@platform/ui/i18n';
import { loadedGame } from './games';

const t = i18n.getFixedT(null, 'platform');

/**
 * The message for a code the server sent: a platform error, or a rule's reason from the game
 * being played (`game`); unknown codes get a generic message.
 */
export function errorText(code: string, game?: string): string {
  const fromGame = game ? loadedGame(game)?.errorText?.(code) : undefined;
  if (fromGame) return fromGame;
  return i18n.exists(`errors.${code}`, { ns: 'platform' })
    ? t(`errors.${code}` as 'errors.unknown')
    : t('errors.unknown');
}
