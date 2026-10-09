import type { LogEntry, PandemicView, TurnLog as TurnLogData } from '@pandemic/rules';
import type { SeatPresence } from '@platform/ui/game';
import { useTranslation } from 'react-i18next';
import { cityName, seatName } from '../lib/names';
import { useCardText } from '../lib/cards';

/** One line of the log: a draw, an epidemic step, or a city infected and its outbreaks. */
function Entry({ entry }: { entry: LogEntry }) {
  const { t } = useTranslation('pandemic');
  const cardText = useCardText();
  switch (entry.type) {
    case 'draw':
      return (
        <li>
          {t('log.draw', {
            cards: entry.cards
              .map((card) => (card.kind === 'epidemic' ? t('log.epidemicCard') : cardText(card)))
              .join(', '),
          })}
        </li>
      );
    case 'epidemic-increase':
      return <li>{t('log.epidemicIncrease', { rate: entry.rate })}</li>;
    case 'epidemic-intensify':
      return <li>{t('log.epidemicIntensify', { count: entry.cards })}</li>;
    case 'infect': {
      const color = t(`color.${entry.color}`);
      const city = cityName(entry.city);
      return (
        <li>
          {entry.epidemic && <span className="font-medium">{t('log.epidemicPrefix')} </span>}
          {entry.eradicated
            ? t('log.eradicated', { city, color })
            : entry.cubes > 0
              ? t('log.infected', { city, color, count: entry.cubes })
              : t('log.noRoom', { city, color })}
          {entry.outbreaks.length > 0 && (
            <span className="ml-1 font-medium text-danger">
              {t('log.outbreaks', { cities: entry.outbreaks.map(cityName).join(' → ') })}
            </span>
          )}
        </li>
      );
    }
  }
}

function Turn({
  turn,
  title,
  presence,
}: {
  turn: TurnLogData;
  title: string;
  presence: SeatPresence | null;
}) {
  const { t } = useTranslation('pandemic');
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-medium text-muted-foreground">
        {title} · {seatName(presence, turn.seat)}
      </h3>
      {turn.entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('log.nothingYet')}</p>
      ) : (
        <ul className="flex list-disc flex-col gap-0.5 pl-4 text-xs">
          {turn.entries.map((entry, i) => (
            <Entry key={i} entry={entry} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** What happened after the actions in this turn and the one before: draws, epidemics, infections. */
export function TurnLog({ view, presence }: { view: PandemicView; presence: SeatPresence | null }) {
  const { t } = useTranslation('pandemic');
  const { current, previous } = view.log;
  return (
    <section aria-labelledby="log-title" className="flex flex-col gap-2">
      <h2 id="log-title" className="font-semibold">
        {t('log.title')}
      </h2>
      <Turn turn={current} title={t('log.current')} presence={presence} />
      {previous && <Turn turn={previous} title={t('log.previous')} presence={presence} />}
    </section>
  );
}
