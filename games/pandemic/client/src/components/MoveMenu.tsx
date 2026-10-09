import type { CityId, PandemicMove, PandemicView, SeatId } from '@pandemic/rules';
import { useTranslation } from 'react-i18next';
import { cityPoint, MAP_HEIGHT, MAP_WIDTH } from '../lib/mapGeometry';
import { movesTo, type MoveType } from '../lib/moves';
import { cityName } from '../lib/names';
import { platform } from '../platform';

const MENU_WIDTH = 190;
const ROW_HEIGHT = 34;
const PADDING = 8;

/** Where a move's card is discarded from, for the cost text (direct: the target; charter: here). */
const costOf = (type: MoveType, here: CityId, to: CityId): CityId | null =>
  type === 'direct' ? to : type === 'charter' ? here : null;

/**
 * The popover a tap on a reachable city opens: every legal way there (drive, direct, charter,
 * shuttle), its cost if it discards a card, and a button that sends the move at once. Positioned
 * in map coordinates next to the city, flipped to stay inside the picture.
 */
export function MoveMenu({
  view,
  you,
  city,
  onDone,
}: {
  view: PandemicView;
  you: SeatId;
  city: CityId;
  onDone: () => void;
}) {
  const { t } = useTranslation('pandemic');
  const here = view.pawns[you] as CityId;
  const moves = movesTo(view, you, city);
  if (moves.length === 0) return null;

  const { x, y } = cityPoint(city);
  const height = PADDING * 2 + moves.length * ROW_HEIGHT + 28;
  const left = x + 20 + MENU_WIDTH > MAP_WIDTH;
  const top = y + 10 + height > MAP_HEIGHT;
  const menuX = left ? x - 20 - MENU_WIDTH : x + 20;
  const menuY = Math.max(4, top ? y - 10 - height : y - height / 2);

  const send = (move: PandemicMove) => {
    void platform().send(move);
    onDone();
  };

  return (
    <foreignObject
      x={menuX}
      y={menuY}
      width={MENU_WIDTH}
      height={height}
      style={{ overflow: 'visible' }}
    >
      <div
        className="flex flex-col gap-1 rounded-lg border bg-popover p-2 text-popover-foreground shadow-lg"
        role="menu"
        aria-label={t('moveMenu.title', { city: cityName(city) })}
      >
        <p className="truncate px-1 text-xs font-semibold text-muted-foreground">
          {t('moveMenu.title', { city: cityName(city) })}
        </p>
        {moves.map((move) => {
          const type = move.type as MoveType;
          const cost = costOf(type, here, city);
          return (
            <button
              key={type}
              type="button"
              className="flex flex-col items-start rounded-md px-2 py-1 text-left text-sm hover:bg-accent"
              onClick={() => send(move)}
            >
              <span className="font-medium">{t(`actions.${type}`)}</span>
              {cost && (
                <span className="text-xs text-muted-foreground">
                  {t('moveMenu.discard', { city: cityName(cost) })}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </foreignObject>
  );
}
