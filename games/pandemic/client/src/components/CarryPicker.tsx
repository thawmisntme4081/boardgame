import {
  COLORS,
  MAX_CARRIED_CUBES,
  carriedOf,
  pawnsOnMap,
  type CityId,
  type Color,
  type PandemicView,
  type PawnId,
} from '@pandemic/rules';
import { Button } from '@platform/ui/components/button';
import type { SeatPresence } from '@platform/ui/game';
import { useTranslation } from 'react-i18next';
import { DISEASE_PALE_TEXT, diseasePale } from '../lib/colors';
import { pawnName } from '../lib/names';
import { usePandemic } from '../store';

/**
 * What `pawn` (a Relocation Specialist's) takes along from its city on its next move: up to 3
 * cubes, a "−" and a "+" per color there, and one other pawn there, a toggle each. The choice is
 * kept in the store (`carry`) for the move that follows; nothing shows when the city has neither.
 */
export function CarryPicker({
  view,
  pawn,
  presence,
  hint,
}: {
  view: PandemicView;
  pawn: PawnId;
  presence: SeatPresence | null;
  /** A line under the title: what to do next. */
  hint?: string;
}) {
  const { t } = useTranslation('pandemic');
  const carry = usePandemic((s) => s.carry);
  const setCarry = usePandemic((s) => s.setCarry);
  const from = view.pawns[pawn] as CityId;
  const colors = COLORS.filter((color) => view.cubes[from][color] > 0);
  const others = pawnsOnMap(view).filter((other) => other !== pawn && view.pawns[other] === from);
  if (colors.length === 0 && others.length === 0) return null;

  const full = carry.cubes.length >= MAX_CARRIED_CUBES;
  const more = (color: Color) => setCarry({ ...carry, cubes: [...carry.cubes, color] });
  const less = (color: Color) => {
    const cubes = [...carry.cubes];
    cubes.splice(cubes.lastIndexOf(color), 1);
    setCarry({ ...carry, cubes });
  };
  const togglePawn = (other: PawnId) =>
    setCarry(carry.pawn === other ? { cubes: carry.cubes } : { ...carry, pawn: other });

  return (
    <fieldset className="flex flex-col gap-2 rounded-md border p-2">
      <legend className="px-1 text-sm font-medium">{t('carry.title')}</legend>
      {hint && <p className="text-sm">{hint}</p>}
      {colors.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {colors.map((color) => {
            const count = carriedOf(carry.cubes, color);
            const name = t(`color.${color}`);
            return (
              <div
                key={color}
                className={`flex items-center gap-1 rounded-md border px-1 ${DISEASE_PALE_TEXT}`}
                style={diseasePale(color)}
              >
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={t('carry.less', { color: name })}
                  disabled={count === 0}
                  onClick={() => less(color)}
                >
                  −
                </Button>
                <span className="text-sm">{t('carry.cubes', { color: name, count })}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={t('carry.more', { color: name })}
                  disabled={full || count >= view.cubes[from][color]}
                  onClick={() => more(color)}
                >
                  +
                </Button>
              </div>
            );
          })}
          <span className="text-sm text-muted-foreground">
            {t('carry.count', { count: carry.cubes.length, max: MAX_CARRIED_CUBES })}
          </span>
        </div>
      )}
      {others.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {others.map((other) => {
            const on = carry.pawn === other;
            return (
              <Button
                key={other}
                size="sm"
                variant={on ? 'default' : 'outline'}
                aria-pressed={on}
                onClick={() => togglePawn(other)}
              >
                {t('carry.pawn', { name: pawnName(presence, other) })}
              </Button>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
