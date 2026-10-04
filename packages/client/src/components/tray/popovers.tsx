// Tap-to-read rules in the dice tray (no hover-only info on phones).
import { landingConditions, type PlayerView } from '@sky/shared';
import { useTranslation } from 'react-i18next';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { POPOVER_TRIGGER } from '@/lib/classes';
import { cn } from '@/lib/utils';
import { abilityText } from '@/scenarioText';

/** The Special Ability cards in play; tap one for its rule. */
export function AbilityList({ view }: { view: PlayerView }) {
  const { t } = useTranslation();
  if (view.abilities.length === 0) return null;
  return (
    <p className="text-xs text-muted-foreground">
      {t('tray.abilities')}{' '}
      {view.abilities.map((ability, i) => {
        const { name, rule } = abilityText(ability);
        return (
          <span key={ability}>
            {i > 0 && ' · '}
            <Popover>
              <PopoverTrigger className={POPOVER_TRIGGER}>{name}</PopoverTrigger>
              <PopoverContent side="top" className="w-64">
                <PopoverHeader>
                  <PopoverTitle>{name}</PopoverTitle>
                  <PopoverDescription>{rule}</PopoverDescription>
                </PopoverHeader>
              </PopoverContent>
            </Popover>
          </span>
        );
      })}
    </p>
  );
}

/**
 * From the round before the final one: what a landing needs (tap for the list). The list
 * comes from the shared rules, so modules add their own conditions.
 */
export function WinConditions({ view, className }: { view: PlayerView; className?: string }) {
  const { t } = useTranslation();
  if (view.round < view.scenario.altitudes.length - 1) return null;
  return (
    <Popover>
      <PopoverTrigger className={cn(POPOVER_TRIGGER, 'self-center', className)}>
        {t('tray.winConditions')}
      </PopoverTrigger>
      <PopoverContent side="top" className="w-64">
        <PopoverHeader>
          <PopoverTitle>{t('tray.winConditions')}</PopoverTitle>
          <PopoverDescription>{t('tray.winConditionsIntro')}</PopoverDescription>
        </PopoverHeader>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {landingConditions(view.scenario).map((reason) => (
            <li key={reason}>{t(`win.${reason}`)}</li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
