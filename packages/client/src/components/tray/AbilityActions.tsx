import {
  canUseAbilityInView,
  type AbilityAction,
  type DieValue,
  type PlayerView,
} from '@sky/shared';
import { ArrowLeftRight, FlipVertical2, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { playAbility } from '@/api';
import { Button } from '@/components/ui/button';
import { abilityText } from '@/scenarioText';

type ActionAbility = AbilityAction['ability'];

/** Adaptation, Anticipation and Working Together for the selected die, when the rules allow. */
export function AbilityActions({
  view,
  dieId,
  value,
}: {
  view: PlayerView;
  dieId: string;
  value: DieValue;
}) {
  const { t } = useTranslation();
  const buttons: { ability: ActionAbility; label: string; icon: ReactNode }[] = [
    {
      ability: 'adaptation',
      label: t('tray.flipTo', { value: 7 - value }),
      icon: <FlipVertical2 />,
    },
    { ability: 'anticipation', label: t('tray.rerollThisDie'), icon: <RotateCcw /> },
    {
      ability: 'working-together',
      label: view.swap ? t('tray.swapFor', { value: view.swap.value }) : t('tray.offerSwap'),
      icon: <ArrowLeftRight />,
    },
  ];
  const usable = buttons.filter(({ ability }) => canUseAbilityInView(view, { ability, dieId }).ok);
  if (usable.length === 0) return null;
  return (
    <div className="flex flex-wrap justify-end gap-2 tablet:justify-start desktop:justify-end">
      {usable.map(({ ability, label, icon }) => (
        <Button
          key={ability}
          variant="outline"
          className="h-auto min-h-11 max-w-full text-left whitespace-normal"
          title={abilityText(ability).rule}
          onClick={() => void playAbility({ ability, dieId })}
        >
          {icon} {label}
          <span className="sr-only"> ({abilityText(ability).name})</span>
        </Button>
      ))}
    </div>
  );
}
