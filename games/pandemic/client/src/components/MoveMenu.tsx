import {
  actingPawn,
  type CityId,
  type PandemicMove,
  type PandemicView,
  type PawnId,
  type SeatId,
} from '@pandemic/rules';
import { useTranslation } from 'react-i18next';
import { cityPoint, MAP_HEIGHT, MAP_WIDTH } from '../lib/mapGeometry';
import { movesTo, type MoveType } from '../lib/moves';
import { cityName, pawnName } from '../lib/names';
import type { SeatPresence } from '@platform/ui/game';
import { platform } from '../platform';
import { carryPart, usePandemic } from '../store';

const MENU_WIDTH = 190;
const ROW_HEIGHT = 34;
const PADDING = 8;

/** The card a move discards, for the cost text (direct: the target; charter: where the pawn is). */
function costOf(move: PandemicMove, from: CityId): CityId | null {
  if (move.type === 'direct') return move.to;
  if (move.type === 'charter') return from;
  if (move.type === 'ops-flight') return move.card;
  return null;
}

/**
 * The popover a tap on a reachable city opens: every legal way to bring `pawn` there (drive,
 * direct, charter, shuttle, and the roles' join and flight), its cost if it discards a card, and a
 * button that sends the move at once, with what the pawn takes along (`carry` in the store).
 * Positioned in map coordinates next to the city, flipped to stay inside the picture.
 */
export function MoveMenu({
  view,
  you,
  pawn = actingPawn(view, you),
  city,
  onDone,
  presence,
}: {
  view: PandemicView;
  you: SeatId;
  /** The pawn to move: yours, or another's for a role that moves pawns. */
  pawn?: PawnId;
  city: CityId;
  onDone: () => void;
  presence: SeatPresence | null;
}) {
  const { t } = useTranslation('pandemic');
  const carry = usePandemic((s) => s.carry);
  const from = view.pawns[pawn] as CityId;
  const moves = movesTo(view, you, city, pawn, carryPart(carry).carry);
  const title =
    pawn === actingPawn(view, you)
      ? t('moveMenu.title', { city: cityName(city) })
      : t('moveMenu.titleFor', { city: cityName(city), name: pawnName(presence, pawn) });
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
        aria-label={title}
      >
        <p className="truncate px-1 text-xs font-semibold text-muted-foreground">{title}</p>
        {moves.map((move) => {
          const type = move.type as MoveType;
          const cost = costOf(move, from);
          return (
            <button
              key={`${type}-${cost ?? ''}`}
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
