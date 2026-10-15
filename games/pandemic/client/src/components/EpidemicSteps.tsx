import type { EpidemicStep, PandemicView } from '@pandemic/rules';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@platform/ui/utils';

const STEPS: readonly EpidemicStep[] = ['increase', 'infect', 'intensify'];

/**
 * An epidemic shown one step at a time: the three steps with the current one marked and the
 * finished ones ticked. The active player presses the button of the step in the action bar.
 */
export function EpidemicSteps({ view }: { view: PandemicView }) {
  const { t } = useTranslation('pandemic');
  const { turn } = view;
  if (view.status !== 'playing' || turn.step !== 'epidemic') return null;
  const current = STEPS.indexOf(turn.epidemicStep);
  return (
    <section
      aria-labelledby="epidemic-title"
      className="flex flex-col gap-2 rounded-lg border border-danger/50 bg-danger/5 p-3"
    >
      <h2 id="epidemic-title" className="font-semibold text-danger">
        {t('epidemic.title', { count: turn.epidemics })}
      </h2>
      <ol className="flex flex-col gap-1 text-sm">
        {STEPS.map((step, i) => (
          <li
            key={step}
            aria-current={i === current ? 'step' : undefined}
            className={cn(
              'flex items-start gap-2',
              i === current ? 'font-semibold' : 'text-muted-foreground',
            )}
          >
            <span className="mt-0.5 size-4 shrink-0">
              {i < current ? <Check className="size-4" aria-hidden="true" /> : `${i + 1}.`}
            </span>
            <span>
              {t(`board.epidemicStep.${step}`)}: {t(`epidemic.step.${step}`)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
