// The Flight Log: wins and losses per scenario and seat, and a list of past games, from this
// device's history (no accounts).
import { AIRPORT_NAMES, SCENARIO_LIST, SCENARIOS, SEATS, type Seat } from '@sky/shared';
import { BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { currentLanguage } from '@/i18n';
import { scenarioStats, type GameRecord, type WinLoss } from '@/lib/history';
import { cn } from '@/lib/utils';
import { endReasonText, seatName } from '@/messages';
import { difficultyName, scenarioCode } from '@/scenarioText';
import { useGame } from '@/store';
import { DifficultyDot } from './ScenarioPicker';

/** The airport code as split-flap tiles: one dark tile per letter. */
function SplitFlap({ code }: { code: string }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={code} role="img">
      {code.split('').map((letter, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="relative grid h-6 w-4.5 place-items-center rounded-sm bg-neutral-900 font-mono text-xs font-bold text-white after:absolute after:inset-x-0 after:top-1/2 after:h-px after:bg-black/60"
        >
          {letter}
        </span>
      ))}
    </span>
  );
}

/** A W/L cell: green with a win, orange with only losses, empty when never played. */
function WinLossCell({ seat, score }: { seat: Seat; score: WinLoss | undefined }) {
  const { t } = useTranslation();
  const played = score && score.won + score.lost > 0;
  return (
    <td
      aria-label={
        played
          ? t('flightLog.cell', { seat: seatName(seat), won: score.won, lost: score.lost })
          : t('flightLog.notPlayed', { seat: seatName(seat) })
      }
      className={cn(
        'px-2 py-1.5 text-center tabular-nums',
        played &&
          (score.won > 0
            ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
            : 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200'),
      )}
    >
      {played ? `${score.won}/${score.lost}` : ''}
    </td>
  );
}

/** One row per scenario, in Flight Log order (green, yellow, red, black). */
function LogTable({ history }: { history: readonly GameRecord[] }) {
  const { t } = useTranslation();
  const stats = scenarioStats(history);
  return (
    <div className="max-h-[55dvh] overflow-y-auto rounded-lg border">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-card text-xs text-muted-foreground shadow-[0_1px_0_var(--color-border)]">
          <tr>
            <th scope="col" className="px-2 py-2 text-left font-medium">
              {t('flightLog.color')}
            </th>
            <th scope="col" className="px-2 py-2 text-left font-medium">
              {t('flightLog.code')}
            </th>
            <th scope="col" className="px-2 py-2 text-left font-medium">
              {t('flightLog.scenario')}
            </th>
            <th scope="col" className="px-2 py-2 font-medium">
              {t('flightLog.pilot')}
            </th>
            <th scope="col" className="px-2 py-2 font-medium">
              {t('flightLog.copilot')}
            </th>
          </tr>
        </thead>
        <tbody>
          {SCENARIO_LIST.map((s) => (
            <tr key={s.id} className="border-t">
              <td className="px-2 py-1.5">
                <span className="sr-only">{difficultyName(s.difficulty)}</span>
                <DifficultyDot scenario={s} />
              </td>
              <td className="px-2 py-1.5">
                <SplitFlap code={scenarioCode(s)} />
              </td>
              <td className="px-2 py-1.5">{AIRPORT_NAMES[s.airport]}</td>
              {SEATS.map((seat) => (
                <WinLossCell key={seat} seat={seat} score={stats[s.id]?.[seat]} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Past games, newest first. */
function HistoryList({ history }: { history: readonly GameRecord[] }) {
  const { t } = useTranslation();
  if (history.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{t('flightLog.empty')}</p>;
  }
  const date = new Intl.DateTimeFormat(currentLanguage(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return (
    <ol className="max-h-[55dvh] divide-y overflow-y-auto rounded-lg border">
      {history.map((game) => {
        const scenario = SCENARIOS[game.scenario];
        const won = game.result === 'won';
        const options = { seat: seatName(game.seat), partner: game.partner, rounds: game.rounds };
        return (
          <li
            key={`${game.at}-${game.scenario}`}
            className="flex flex-col gap-0.5 px-3 py-2 text-sm"
          >
            <span className="flex items-center gap-2">
              {scenario && <DifficultyDot scenario={scenario} />}
              <span className="font-medium">{scenario?.name ?? game.scenario}</span>
              <span
                className={cn(
                  'ml-auto rounded-full px-2 py-0.5 text-xs font-semibold text-white',
                  won ? 'bg-emerald-600' : 'bg-danger',
                )}
              >
                {won ? t('flightLog.won') : t('flightLog.lost')}
              </span>
            </span>
            <span className="text-xs text-muted-foreground">
              {date.format(game.at)} ·{' '}
              {game.partner ? t('flightLog.entry', options) : t('flightLog.entryAlone', options)}
            </span>
            {!won && game.reasons.length > 0 && (
              <span className="text-xs text-danger">
                {game.reasons.map((r) => endReasonText(r)).join(' · ')}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** A button that opens the Flight Log (from the lobby and the game-over dialog). */
export function FlightLog({ className }: { className?: string }) {
  const { t } = useTranslation();
  const history = useGame((s) => s.history);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" className={cn('h-11', className)}>
          <BookOpen /> {t('flightLog.open')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] gap-3 desktop:max-w-2xl!">
        <DialogHeader>
          <DialogTitle>{t('flightLog.title')}</DialogTitle>
          <DialogDescription>{t('flightLog.intro')}</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="log">
          <TabsList className="w-full">
            <TabsTrigger value="log" className="h-9">
              {t('flightLog.tabLog')}
            </TabsTrigger>
            <TabsTrigger value="history" className="h-9">
              {t('flightLog.tabHistory')}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="log">
            <LogTable history={history} />
          </TabsContent>
          <TabsContent value="history">
            <HistoryList history={history} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
